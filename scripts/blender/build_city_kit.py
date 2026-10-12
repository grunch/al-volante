"""Build original, metric street assets with Blender and export evaluated meshes for Three.js."""
import argparse
import base64
import json
import math
from pathlib import Path
import random
import struct
import sys

import bpy
from mathutils import Vector, noise

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--blend-output', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(1303)
asset = ''
materials = {}


def point(v):
    """Convert a game-space (x, y, z) point to Blender coordinates (x, -z, y)."""
    return Vector((v[0], -v[2], v[1]))


def material(color, finish='matte'):
    """Return a cached Blender material for a six-digit sRGB hex color and finish."""
    key = (color, finish)
    if key not in materials:
        m = bpy.data.materials.new(f'{finish}_{color}')
        rgb = tuple(int(color[i:i+2], 16) / 255 for i in (0, 2, 4))
        linear = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb)
        m.diffuse_color = (*linear, 1)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*linear, 1)
        bsdf.inputs['Roughness'].default_value = {'glass': .18, 'metal': .3, 'paint': .32}.get(finish, .86)
        bsdf.inputs['Metallic'].default_value = {'glass': .35, 'metal': .7, 'paint': .22}.get(finish, 0)
        m['finish'] = finish
        materials[key] = m
    return materials[key]


def tag(obj, color, finish='matte', smooth=False):
    """Assign the current asset, material and face smoothing to an object; return it."""
    obj['asset'] = asset
    obj.data.materials.append(material(color, finish))
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    return obj


def mesh(name, vertices, faces, color, finish='matte', smooth=False):
    """Create and link a tagged mesh from game-space vertices and indexed faces."""
    data = bpy.data.meshes.new(name)
    data.from_pydata([point(v) for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return tag(obj, color, finish, smooth)


def box(name, position, size, color, bevel=0, finish='matte'):
    """Create a tagged box with game-space center and full sizes in meters.

    Apply scale before adding optional bevel and weighted-normal modifiers."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(position))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    tag(obj, color, finish)
    if bevel:
        mod = obj.modifiers.new('Edge highlights', 'BEVEL')
        mod.width = min(bevel, min(size) / 3)
        mod.segments = 1
        mod.affect = 'EDGES'
        normals = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
    return obj


def ellipsoid(name, center, radius, color, finish='matte', segments=12, rings=8):
    """Create a smooth tagged sphere scaled by game-space axis radii in meters."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=point(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radius[0], radius[2], radius[1])
    return tag(obj, color, finish, True)


def tube(name, a, b, radius, color, end_radius=None, finish='matte', sides=8):
    """Create a tagged tube between game-space endpoints, with flat end caps.

    Radii are in meters; end_radius defaults to radius for a cylindrical tube."""
    a, b = point(a), point(b)
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius,
        radius2=radius if end_radius is None else end_radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    tag(obj, color, finish, True)
    for polygon in obj.data.polygons:
        if abs(polygon.normal.z) > 1 - 1e-6:
            polygon.use_smooth = False
    return obj


def torus(name, center, major, minor, color, axis='x', finish='matte', segments=20):
    """Create a smooth tagged torus whose normal follows the given game-space axis."""
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=6,
        location=point(center), major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    # Blender's default torus is in XY; convert its normal to a game axis.
    normal = point((1,0,0) if axis=='x' else (0,0,1) if axis=='z' else (0,1,0))
    obj.rotation_euler = normal.to_track_quat('Z', 'Y').to_euler()
    return tag(obj, color, finish, True)


def wheel(x, y, z, radius):
    """Add a tire, alloy rim, spokes and hub at a game-space center in meters."""
    torus('Tyre sidewall', (x,y,z), radius*.79, radius*.21, '202225')
    outer = x + math.copysign(.07, x)
    tube('Alloy rim', (outer-.015,y,z), (outer+.015,y,z), radius*.57, '919b9f', finish='metal', sides=16)
    tube('Dark hub recess', (outer-.017,y,z), (outer+.017,y,z), radius*.46, '353c40', finish='metal', sides=12)
    for i in range(5):
        a=i*math.tau/5
        tube('Alloy spoke', (outer,y,z), (outer,y+math.sin(a)*radius*.49,z+math.cos(a)*radius*.49),
             .019, 'bac2c4', finish='metal', sides=5)
    tube('Hub cap', (outer-.022,y,z), (outer+.022,y,z), radius*.15, 'bbc4c8', finish='metal')


def loft(name, stations, color, finish='paint'):
    """Create a beveled body from (z, half-width, bottom, top) stations in meters."""
    vertices=[]
    # Rounded shoulders, a broad hood and a narrowed sill; no box-shaped passenger car.
    for z,w,bottom,top in stations:
        corner=min(.1,(top-bottom)*.2)
        vertices += [(x,y,z) for x,y in [(-w*.88,bottom),(-w,bottom+corner),(-w,top-corner),
                    (-w*.87,top),(w*.87,top),(w,top-corner),(w,bottom+corner),(w*.88,bottom)]]
    faces=[tuple(reversed(range(8)))]
    for j in range(len(stations)-1):
        for k in range(8):
            faces.append((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k))
    faces.append(tuple(range((len(stations)-1)*8,len(stations)*8)))
    obj=mesh(name,vertices,[tuple(reversed(face)) for face in faces],color,finish,True)
    bevel=obj.modifiers.new('Body crease bevels','BEVEL'); bevel.width=.035; bevel.segments=2
    return obj


def car():
    """Add the passenger-car body, glazing, wheels and trim to the current asset."""
    loft('Sculpted body',[(-2.04,.69,.39,.82),(-1.65,.79,.35,.90),(-.9,.81,.35,.94),
         (.9,.81,.35,.9),(1.70,.75,.40,.80),(2.04,.66,.44,.72)],'849fa9')
    loft('Window belt',[(-1.36,.67,.9,1.03),(-.77,.65,.89,1.43),(.48,.64,.89,1.43),
         (1.20,.68,.86,.93)],'526b79','glass')
    box('Roof',(0,1.435,-.12),(1.22,.065,1.25),'849fa9',.025,'paint')
    for side in [-1,1]:
        x=side*.69
        tube('A pillar',(x,.92,1.17),(side*.61,1.43,.48),.029,'849fa9',finish='paint')
        tube('C pillar',(x,.94,-1.34),(side*.61,1.43,-.77),.040,'849fa9',finish='paint')
        tube('B pillar',(side*.685,.92,-.12),(side*.635,1.43,-.12),.035,'222c30')
        for z in [-.76,.52]:
            box('Door handle',(side*.806,.84,z),(.038,.035,.17),'c3c8c8',.012,'metal')
            tube('Door seam',(side*.81,.47,z-.29),(side*.81,.88,z-.30),.008,'465661',sides=4)
        box('Mirror housing',(side*.855,1.03,.58),(.16,.11,.21),'849fa9',.036,'paint')
        box('Mirror glass',(side*.853,1.035,.477),(.12,.072,.016),'aebdbe',.01,'glass')
        for z in [-1.30,1.29]: wheel(side*.755,.31,z,.31)
        box('Front lamp',(side*.49,.655,2.04),(.36,.12,.09),'e2e4d9',.035,'glass')
        box('Rear lamp',(side*.54,.74,-2.04),(.22,.16,.09),'a62922',.025,'glass')
        box('Sill trim',(side*.795,.39,0),(.04,.07,2.5),'303a3d',.01)
    box('Lower grille',(0,.52,2.052),(.82,.12,.035),'252c2e',.015)
    for y in [.50,.54,.58]: box('Grille slat',(0,y,2.075),(.76,.01,.012),'677278',0,'metal')
    for z in [-2.07,2.07]: box('Blank plate',(0,.69,z),(.34,.085,.012),'d5dcd9',.005)
    for side in [-1,1]:
        tube('Wiper',(side*.34,.99,.99),(side*.02,1.05,.91),.008,'242b30',sides=5)


def van(bus=False):
    """Add an emergency van, or a passenger bus when bus is true, to the current asset."""
    length=11.6 if bus else 4.8
    half=length/2
    width=2.36 if bus else 1.94
    top=2.93 if bus else 2.23
    box('Coach body',(0,top/2+.14,0),(width,top-.28,length),'c8d3cd' if bus else 'e7e9de',.16,'paint')
    box('Glazing band',(0,top-.61,0),(width+.008,.87,length-.5),'273e49',.06,'glass')
    for z in [-half+.17,half-.17]:
        box('End panel',(0,top-.62,z),(width-.08,.85,.10),'273e49',.03,'glass')
    for side in [-1,1]:
        for z in [-half*.63,half*.63]: wheel(side*(width/2-.11),.42 if bus else .33,z,.42 if bus else .33)
        for z in [(-half+.5)+i*.93 for i in range(int(length/.93))]:
            box('Window mullion',(side*(width/2+.01),top-.61,z),(.025,.91,.052),'48595c',.005)
        box('Livery',(side*(width/2+.014),1.01,0),(.025,.23,length-.3),'4b8281' if bus else 'a83630',.008)
        for y in [1.55,1.65,1.75,1.85]:
            box('Rear vent',(side*(width/2+.02),y,-half+.48),(.017,.025,.5),'515f60')
        box('Mirror arm',(side*(width/2-.03),top-.52,half-.12),(.07,.10,.35),'333d42',.015)
        box('Mirror',(side*(width/2-.03),top-.65,half-.24),(.095,.26,.13),'343d40',.02)
        for z,color in [(half,'ece3bc'),(-half,'bd3024')]:
            box('Lamp',(side*width*.35,.79,z),(.19,.16,.03),color,.025,'glass')
    if bus:
        for z in [half-1.2,-.35]:
            box('Passenger door',(width/2+.018,1.35,z),(.018,2.1,1.03),'25383b',.005,'glass')
            box('Door division',(width/2+.03,1.35,z),(.02,2.1,.035),'80928e')
        box('Destination display',(0,top-.2,half-.05),(1.72,.24,.10),'172324',.025)
        box('Roof equipment',(0,top+.04,-.8),(1.1,.16,2.4),'b4bdb6',.05)
    else:
        box('Beacon',(0,top+.035,.18),(1.1,.13,.23),'326cb6',.035,'glass')
        for side in [-1,1]:
            box('Cross upright',(side*(width/2+.03),1.30,-.7),(.025,.48,.13),'ae3430')
            box('Cross arms',(side*(width/2+.03),1.30,-.7),(.025,.13,.48),'ae3430')


def person(cyclist=False):
    """Add a clothed pedestrian, or a posed rider with a bicycle, to the current asset."""
    skin='b89272'; coat='416376' if not cyclist else 'b78132'
    hips=.85 if not cyclist else .91
    torso=ellipsoid('Tailored jacket',(0,hips+.31,-.025),(.21,.29,.115),coat)
    if cyclist: torso.rotation_euler.x=.24
    ellipsoid('Trouser hips',(0,hips+.01,0),(.185,.15,.105),'343d47')
    box('Jacket placket',(0,hips+.3,.096),(.026,.44,.017),'304957',.003)
    for side in [-1,1]:
        box('Pocket welt',(side*.13,hips+.20,.097),(.08,.018,.015),'314b59')
        shoulder=(side*.22,hips+.48,-.025)
        elbow=(side*.25,hips+.21,.10 if cyclist else -.015)
        wrist=(side*.235,hips+.08,.38 if cyclist else .02)
        ellipsoid('Shoulder seam',shoulder,(.09,.105,.09),coat,segments=12,rings=8)
        ellipsoid('Elbow seam',elbow,(.075,.08,.075),coat,segments=12,rings=8)
        tube('Sleeve upper',shoulder,elbow,.072,coat,end_radius=.061)
        tube('Sleeve lower',elbow,wrist,.062,coat,end_radius=.045)
        ellipsoid('Hand',wrist,(.048,.075,.04),skin,segments=8,rings=6)
        knee=(side*.108,.51,.23 if cyclist and side==1 else -.10 if cyclist else .025)
        ankle=(side*.108,.30 if cyclist else .105,.02)
        tube('Trouser thigh',(side*.108,hips,0),knee,.085,'343d47',end_radius=.071)
        ellipsoid('Trouser knee',knee,(.078,.08,.078),'343d47',segments=12,rings=8)
        tube('Trouser shin',knee,ankle,.066,'343d47',end_radius=.05)
        ellipsoid('Shoe',(ankle[0],ankle[1]-.025,.055),(.065,.065,.14),'282c30',segments=10,rings=6)
        box('Shoe sole',(ankle[0],ankle[1]-.075,.06),(.13,.025,.23),'a9aaa3',.01)
    tube('Neck',(0,hips+.53,0),(0,hips+.64,0),.058,skin)
    ellipsoid('Face',(0,hips+.75,.012),(.106,.145,.097),skin)
    ellipsoid('Hair',(0,hips+.81,-.012),(.110,.10,.091),'342e29')
    ellipsoid('Nose',(0,hips+.75,.110),(.025,.038,.027),skin,segments=8,rings=6)
    for side in [-1,1]:
        ellipsoid('Ear',(side*.104,hips+.74,.004),(.022,.045,.024),skin,segments=8,rings=6)
        ellipsoid('Eye',(side*.040,hips+.775,.106),(.011,.007,.004),'302d29',segments=6,rings=4)
        box('Eyebrow',(side*.041,hips+.795,.098),(.04,.009,.008),'46372c')
    box('Mouth',(0,hips+.695,.102),(.037,.006,.003),'80634f')
    if cyclist:
        ellipsoid('Helmet',(0,hips+.845,.004),(.123,.085,.115),'c8cbb8')
        for z in [-.61,.61]:
            torus('Bicycle tyre',(0,.32,z),.292,.022,'232a2b',segments=20)
            torus('Bicycle rim',(0,.32,z),.26,.009,'9eaaaf',finish='metal',segments=20)
            for i in range(8):
                a=i*math.tau/8
                tube('Spoke',(0,.32,z),(0,.32+math.sin(a)*.26,z+math.cos(a)*.26),.004,'899da3',sides=3)
        joints=[(0,.32,-.61),(0,.36,0),(0,.78,-.19),(0,.32,.61),(0,.89,.50)]
        for a,b in [(0,1),(0,2),(1,2),(1,3),(2,4),(3,4),(1,4)]: tube('Bicycle frame',joints[a],joints[b],.023,'427b74',finish='metal')
        box('Saddle',(0,.81,-.19),(.19,.065,.25),'303a3c',.025)
        tube('Handlebar',(-.23,1.03,.42),(.23,1.03,.42),.018,'9ba8aa',finish='metal')
    else:
        box('Shoulder bag',(-.247,.98,-.08),(.105,.25,.17),'786251',.025)
        tube('Bag strap',(-.22,1.36,0),(-.25,1.03,-.075),.013,'55473c',sides=5)


def tree(seed, sparse=False, distant=False):
    """Add a seeded branching tree with individual leaves to the current asset.

    A local random generator keeps the seed reproducible; sparse reduces leaf count."""
    rng=random.Random(seed)
    leaves=[]; leaf_faces=[]
    tips=[]
    tube('Rooted trunk',(0,0,0),(.17,3.9,.07),.23,'716c5c',end_radius=.13,sides=6 if distant else 10)
    for i in range(0 if distant else 5):
        a=i*math.tau/5
        tube('Root flare',(math.cos(a)*.40,.10,math.sin(a)*.40),(0,.65,0),.075,'777161',end_radius=.13)
    for i in range(7):
        a=i*2.399+seed
        origin=(.10,2.8+i*.18,.03)
        end=(math.cos(a)*2.0,5.5+rng.random()*1.3,math.sin(a)*2.0)
        tube('Main bough',origin,end,.10,'797465',end_radius=.035,sides=5 if distant else 8)
        for j in range(3):
            angle=a+(j-1)*.65
            tip=(end[0]+math.cos(angle)*(1.0+rng.random()*.5),end[1]+.55+rng.random(),end[2]+math.sin(angle)*1.2)
            tube('Twig',end,tip,.030,'817867',end_radius=.008,sides=3 if distant else 5)
            tips.append(tip)
    for tip in tips:
        for j in range((6 if sparse else 10) if distant else (38 if sparse else 78)):
            direction=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-1,1))).normalized()
            center=Vector(tip)+direction*rng.random()**(1/3)*1.05
            normal=Vector((rng.uniform(-1,1),rng.uniform(.15,1),rng.uniform(-1,1))).normalized()
            u=normal.cross(Vector((0,0,1))).normalized()*(rng.uniform(.26,.38) if distant else rng.uniform(.085,.16))
            v=normal.cross(u).normalized()*u.length*.48
            base=len(leaves)
            leaves.extend([center-u,center+v+normal*.035,center+normal*.045,center+u,center-v+normal*.035])
            leaf_faces.extend([(base,base+1,base+3),(base+3,base+4,base)])
    obj=mesh('Individual folded leaves',leaves,leaf_faces,'71804a','foliage')
    colors=['526436','71834a','879752','647b3c']
    for color in colors: obj.data.materials.append(material(color,'foliage'))
    for poly in obj.data.polygons: poly.material_index=(poly.index//2)%len(colors)


def signal():
    """Add a signal post, housing, bezels and visors; runtime code supplies the lenses."""
    tube('Signal post',(0,0,0),(0,3.16,0),.058,'4c5757',sides=12)
    tube('Post foot',(0,0,0),(0,.25,0),.095,'555d5b',sides=12)
    box('Yellow signal backplate',(0,2.65,-.075),(.43,1.16,.17),'c39e28',.06,'paint')
    box('Black signal face',(0,2.65,-.175),(.32,1.01,.08),'252f30',.045)
    for y in [2.96,2.65,2.34]:
        # Open-front half-cylinder visor; lenses remain runtime state-driven objects.
        vertices=[]; faces=[]
        for z in [-.23,-.40]:
            for i in range(13):
                a=i*math.pi/12
                vertices.append((math.cos(a)*.141,y+math.sin(a)*.141,z))
        for i in range(12): faces.append((i,i+1,i+14,i+13))
        visor=mesh('Lens sun visor',vertices,faces,'273233')
        solid=visor.modifiers.new('Visor thickness','SOLIDIFY'); solid.thickness=.008
        torus('Lens bezel',(0,y,-.228),.121,.012,'3b4442',axis='z',segments=20)
    for y in [2.27,3.05]:
        box('Mounting collar',(0,y,.032),(.16,.06,.12),'626e6a',.015,'metal')


def facade():
    """Add a framed window, glazing, curtains and sill with the front facing game +X."""
    # Front points toward +X, so one rotation serves either side of the street.
    box('Window reveal',(0,0,0),(.12,1.9,1.46),'c8c7b9',.025)
    box('Recessed glazing',(.069,0,0),(.025,1.67,1.24),'263d45',.008,'glass')
    for y in [-.87,.87]: box('Frame head',(.11,y,0),(.085,.07,1.40),'d4d5c7',.01,'metal')
    for z in [-.67,0,.67]: box('Frame jamb',(.11,0,z),(.08,1.74,.042),'d4d5c7',.006,'metal')
    box('Sill',(.20,-.96,0),(.40,.10,1.57),'aaa998',.025)
    for side in [-1,1]:
        box('Curtain',(.089,.02,side*.43),(.012,1.58,.32),'bdbcb1')
    box('Lower reflection',(.087,-.46,0),(.01,.40,1.22),'496067',0,'glass')


def aircon():
    """Add a wall-mounted air conditioner with grille and brackets facing game +X."""
    box('Air conditioner casing',(0,0,0),(.40,.48,.72),'bdbfaf',.035)
    for i in range(7): box('Heat exchanger louvre',(.207,-.16+i*.05,.21),(.016,.014,.22),'727e78')
    torus('Fan grille',(.211,0,-.14),.16,.014,'6d7874',finish='metal',segments=20)
    for a in [0,math.pi/3,2*math.pi/3]:
        tube('Fan grille bar',(.213,math.sin(a)*.15,-.14+math.cos(a)*.15),(.213,-math.sin(a)*.15,-.14-math.cos(a)*.15),.007,'74827b',sides=4)
    for z in [-.25,.25]: box('Wall bracket',(-.05,-.29,z),(.57,.055,.04),'64736b',.008,'metal')


def drain():
    """Add a horizontal drain frame, dark opening and grille to the current asset."""
    box('Drain frame',(0,0,0),(.42,.032,.76),'55584f',.008,'metal')
    box('Dark opening',(0,.02,0),(.34,.012,.68),'202926')
    for i in range(9): box('Drain slat',(0,.03,-.30+i*.075),(.35,.025,.016),'73786b',.004,'metal')


def manhole():
    """Add a circular horizontal cover with an inset and grip bars to the current asset."""
    tube('Manhole frame',(0,0,0),(0,.015,0),.34,'575f59',finish='metal',sides=32)
    tube('Manhole inset',(0,.016,0),(0,.023,0),.30,'747b70',finish='metal',sides=32)
    for z in [-.20,-.10,0,.10,.20]:
        span=math.sqrt(.28**2-z*z)*2
        box('Cover grip',(0,.027,z),(span,.008,.014),'424e48',.002)


def distant_car():
    """Keep windows, lamps and wheels in a single low-cost material at a distance."""
    box('Body',(0,.65,0),(1.57,.52,4.08),'849fa9')
    box('Windows',(0,1.12,-.12),(1.28,.56,2.3),'405c69')
    box('Roof',(0,1.43,-.12),(1.23,.05,1.25),'849fa9')
    for side in [-1,1]:
        for z in [-1.30,1.29]:
            tube('Wheel',(side*.71,.31,z),(side*.84,.31,z),.31,'232629',sides=8)
        box('Headlight',(side*.49,.66,2.05),(.36,.12,.03),'e2e4d9')
        box('Tail lamp',(side*.54,.74,-2.05),(.22,.16,.03),'a62922')


def distant_window():
    """Preserve contrast and opening proportions without tiny frame geometry."""
    box('Reveal',(0,0,0),(.12,1.9,1.46),'c8c7b9')
    box('Glass',(.07,0,0),(.025,1.67,1.24),'334e5b')


def container():
    """Original wheeled street recycling container with lid, pedals and handles."""
    box('Tapered green body',(0,.67,0),(1.22,1.12,.88),'456a56',.09)
    box('Lid',(0,1.26,0),(1.34,.13,.99),'344d41',.06)
    box('Deposit opening',(0,1.16,.453),(.68,.15,.026),'202d28',.025)
    box('Blank service panel',(0,.79,.46),(.48,.27,.024),'b9c7ad',.014)
    for x in [-.52,.52]:
        for z in [-.31,.31]:
            tube('Caster axle',(x-.04,.13,z),(x+.04,.13,z),.12,'2e3433',sides=10)
        tube('Side handle',(x,.93,-.18),(x,.93,.18),.035,'bbc1af',finish='metal')
    tube('Lid hinge',(-.56,1.2,-.46),(.56,1.2,-.46),.045,'2b3b32')
    box('Foot pedal',(0,.16,.50),(.44,.05,.15),'727a6a',.014,'metal')


def scooter():
    """A parked scooter with seat, fork, mirrors and brake discs; no brand or plate data."""
    for z in [-.63,.63]:
        torus('Tyre',(0,.24,z),.19,.055,'262c2d',segments=14)
        tube('Wheel hub',(-.055,.24,z),(.055,.24,z),.12,'939d9e',finish='metal',sides=12)
    loft('Rear fairing',[(-.82,.12,.3,.55),(-.4,.24,.25,.60),(.05,.19,.3,.44)],'a7b2b4')
    box('Seat',(0,.68,-.39),(.44,.12,.65),'293033',.055)
    box('Footboard',(0,.3,.12),(.39,.07,.58),'454d4d',.03)
    tube('Steering fork',(0,.25,.63),(0,.98,.45),.07,'8b9899',finish='metal')
    box('Leg shield',(0,.66,.43),(.47,.56,.12),'9daeb0',.05,'paint')
    tube('Handlebars',(-.29,1.02,.43),(.29,1.02,.43),.034,'303a3c',finish='metal')
    box('Headlamp',(0,.96,.54),(.23,.16,.05),'dfe2d9',.04,'glass')
    for side in [-1,1]:
        tube('Mirror stem',(side*.22,1.02,.43),(side*.32,1.27,.44),.012,'9ca5a3',finish='metal')
        ellipsoid('Mirror',(side*.32,1.29,.44),(.10,.065,.032),'c6d3d5','glass',segments=8,rings=4)
    tube('Kickstand',(0,.30,-.17),(.26,.015,-.17),.025,'67736e',finish='metal')


def bike_rack():
    """An inverted U rack and base plates, dimensioned for the sidewalk."""
    for z in [-.38,.38]:
        tube('Rack leg',(0,0,z),(0,.78,z),.035,'78847c',finish='metal',sides=8)
        box('Base plate',(0,.02,z),(.17,.03,.17),'5a6660',.01,'metal')
    tube('Top rail',(0,.78,-.38),(0,.78,.38),.035,'78847c',finish='metal',sides=8)


builders={'car':car,'bus':lambda:van(True),'emergency':van,'pedestrian':person,
          'bicycle':lambda:person(True),'tree':lambda:tree(41),'treeSparse':lambda:tree(79,True),
          'signal':signal,'window':facade,'aircon':aircon,'drain':drain,'manhole':manhole,
          'treeLow':lambda:tree(41,distant=True),'treeSparseLow':lambda:tree(79,True,True),
          'carLow':distant_car,'windowLow':distant_window,'container':container,'scooter':scooter,'bikeRack':bike_rack}
for asset,builder in builders.items():
    builder()



def pack(values,fmt):
    """Encode numeric values as little-endian struct data and return ASCII base64.

    fmt is the struct element code, such as f, h, B or H, used by the runtime decoder."""
    return base64.b64encode(struct.pack('<'+str(len(values))+fmt,*values)).decode('ascii')


catalog={}
depsgraph=bpy.context.evaluated_depsgraph_get()
for name in builders:
    batches={}
    for obj in [o for o in bpy.data.objects if o.type=='MESH' and o.get('asset')==name]:
        evaluated=obj.evaluated_get(depsgraph)
        data=evaluated.to_mesh(); data.calc_loop_triangles()
        transform=obj.matrix_world
        normal_matrix=transform.to_3x3().inverted().transposed()
        for triangle in data.loop_triangles:
            mat=data.materials[triangle.material_index]
            finish=mat.get('finish','matte')
            batch=batches.setdefault(finish,{'vertices':[], 'normals':[], 'colors':[], 'indices':[], 'lookup':{}})
            # Export linear vertex colours; Three.js does the display transform once.
            rgb=tuple(round(max(0,min(1,v))*255) for v in mat.diffuse_color[:3])
            for loop_index in triangle.loops:
                vertex=data.vertices[data.loops[loop_index].vertex_index]
                p=transform@vertex.co
                n=(normal_matrix@data.corner_normals[loop_index].vector).normalized()
                position=tuple(round(v,5) for v in (p.x,p.z,-p.y))
                normal=tuple(round(v*32767) for v in (n.x,n.z,-n.y))
                key=(*position,*normal,*rgb)
                if key not in batch['lookup']:
                    batch['lookup'][key]=len(batch['vertices'])//3
                    batch['vertices'].extend(position); batch['normals'].extend(normal); batch['colors'].extend(rgb)
                batch['indices'].append(batch['lookup'][key])
        evaluated.to_mesh_clear()
    entries=[]
    for finish,b in batches.items():
        assert len(b['vertices'])//3<65536
        # Blender may enumerate identical evaluated triangles in a different order between runs.
        vertices=sorted(b['lookup'])
        canonical={vertex:i for i,vertex in enumerate(vertices)}
        remap={old:canonical[vertex] for vertex,old in b['lookup'].items()}
        triangles=[]
        for i in range(0,len(b['indices']),3):
            triangle=tuple(remap[index] for index in b['indices'][i:i+3])
            triangles.append(min(triangle,triangle[1:]+triangle[:1],triangle[2:]+triangle[:2]))
        entries.append({'finish':finish,
                        'position':pack([v for vertex in vertices for v in vertex[:3]],'f'),
                        'normal':pack([v for vertex in vertices for v in vertex[3:6]],'h'),
                        'color':pack([v for vertex in vertices for v in vertex[6:]],'B'),
                        'index':pack([i for triangle in sorted(triangles) for i in triangle],'H')})
    catalog[name]=entries
    print(name, sum(len(b['indices'])//3 for b in batches.values()), 'triangles')
args.output.parent.mkdir(parents=True,exist_ok=True)
# Bake periodic micro-height fields with Blender's noise kernel, independent of a render device.
surfaces={}
for surface in ['asphalt','sidewalk']:
    pixels=[]
    size=256
    for y in range(size):
        for x in range(size):
            ax=x/size*math.tau; ay=y/size*math.tau
            grain=noise.noise(Vector((math.cos(ax)*18,math.sin(ax)*18,math.cos(ay)*18)),noise_basis='PERLIN_ORIGINAL')
            fine=noise.noise(Vector((math.cos(ay)*47,math.sin(ay)*47,math.sin(ax)*47)),noise_basis='PERLIN_ORIGINAL')
            if surface=='sidewalk':
                joint=min(x%64,63-x%64,y%64,63-y%64)
                tile=((x//64)*3+y//64)%5
                value=80 if joint<1 else 152 if joint<2 else 212+grain*12+fine*8-tile*4
            else:
                value=190+grain*18+fine*10+random.Random(y*size+x+991).uniform(-35,35)
            pixels.append(round(max(0,min(255,value))))
    surfaces[surface]={'size':size,'height':pack(pixels,'B')}
args.output.write_text(json.dumps({'version':1,'generator':'Blender 5.2 / build_city_kit.py','models':catalog,'surfaces':surfaces},separators=(',',':'))+'\n')
print('Exported',args.output.name,args.output.stat().st_size,'bytes')

if args.blend_output:
    for i,name in enumerate(builders):
        offset=Vector(((i%4)*9,(i//4)*12,0))
        collection=bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        for obj in [o for o in bpy.data.objects if o.get('asset')==name]:
            obj.location+=offset
            for existing in list(obj.users_collection): existing.objects.unlink(obj)
            collection.objects.link(obj)
    args.blend_output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend_output.resolve()))
