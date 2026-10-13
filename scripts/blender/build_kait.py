"""Build an editable Nissan Kait study from supplied exterior and cabin references.

Coordinates: X points to the driver's left, Y to the rear, Z upwards. Units are
meters. This is an original surface reconstruction, not a manufacturer CAD model.
"""

import argparse
import json
import math
from pathlib import Path
import sys

# Blender does not add the script directory to Python's module search path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_device import configure_cycles_device

import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon


parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--draft', action='store_true')
parser.add_argument('--skip-renders', action='store_true')
parser.add_argument('--views', default='front,rear,side,interior')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
collections = {}
for name in ['Body panels', 'Glass and seals', 'Exterior details', 'Wheels', 'Cabin', 'Studio']:
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    collections[name] = collection
active_collection = 'Body panels'


def attach(obj, mat=None, smooth=False):
    """Move an object into its semantic collection and assign its finish."""
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    collections[active_collection].objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if smooth and obj.type == 'MESH':
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def material(name, color, roughness=.4, metallic=0, coat=0, transmission=0, emission=0, grain=0):
    """Create a physically based finish, with optional procedural microstructure."""
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = .16
    shader.inputs['Transmission Weight'].default_value = transmission
    shader.inputs['IOR'].default_value = 1.46
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    if grain:
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 600 if grain < .0003 else 190
        noise.inputs['Detail'].default_value = 2
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .28
        bump.inputs['Distance'].default_value = grain
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat


paint = material('Pearl white multilayer paint', (.74, .755, .77), .24, .25, .8, grain=.000075)
black = material('Satin molded exterior trim', (.005, .006, .008), .49, grain=.00018)
piano = material('Gloss black trim', (.006, .009, .014), .16, .28, .65)
wheel_black = material('Satin black wheel blade', (.008, .010, .014), .32, .38, .3)
mirror_black = material('Black mirror housing', (.004, .006, .008), .30, .08, .32)
rubber = material('Tire rubber', (.018, .021, .025), .66, grain=.00035)
groove = material('Rubber grooves and panel gaps', (.005, .007, .009), .79)
metal = material('Diamond cut alloy', (.65, .70, .75), .23, .94)
bumper_silver = material('Satin silver bumper finish', (.40, .44, .49), .36, .65, .2)
chrome = material('Bright chrome', (.83, .86, .9), .13, 1)
steel = material('Brake steel', (.22, .25, .29), .43, .88, grain=.00008)
glass = material('Lightly tinted laminated glass', (.74, .84, .86), .085, .02, .2, 1)
rear_glass = material('Rear privacy glass', (.27, .37, .39), .10, .02, .2, 1)
lens = material('Smoked lamp polycarbonate', (.035, .048, .057), .17, .15, .65)
led = material('White LED guides', (.76, .90, 1), .19, .2, emission=2)
red = material('Ruby tail lamp optics', (.28, .006, .012), .19, .26, .7, emission=.15)
red_led = material('Red LED light guide', (.65, .006, .014), .2, .15, emission=1.4)
leather = material('Fine grained black leather', (.006, .008, .011), .58, grain=.00027)
dash = material('Dashboard molded soft touch', (.010, .013, .017), .66, grain=.00016)
insert = material('Charcoal blue dashboard insert', (.024, .035, .043), .56, grain=.0001)
cloth = material('Seat insert fabric', (.028, .035, .043), .78, grain=.0004)
thread = material('Warm gray stitching', (.29, .31, .30), .7)
screen = material('Black display glass', (.002, .006, .014), .14, .24, .6)
blue = material('Instrument display blue', (.008, .12, .30), .33, emission=.5)
white = material('Instrument lettering', (.8, .87, .9), .48, emission=.16)
amber = material('Amber indicator', (.95, .33, .015), .4, emission=.7)


def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return attach(obj, mat, smooth)


def bevel(obj, width=.008, segments=3):
    for face in obj.data.polygons:
        face.use_smooth = True
    mod = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
    mod.width, mod.segments = width, segments
    normals = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    return obj


def box(name, pos, size, mat, radius=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    attach(obj, mat)
    if radius:
        bevel(obj, min(radius, min(size) * .44), 4)
    return obj


def sphere(name, pos, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1, location=pos)
    obj = bpy.context.object
    obj.name, obj.scale = name, size
    return attach(obj, mat, True)


def cylinder(name, a, b, radius, mat, sides=48):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    attach(obj, mat, True)
    for face in obj.data.polygons:
        if len(face.vertices) > 4:
            face.use_smooth = False
    return bevel(obj, .0015, 2)


def curve(name, points, radius, mat, cyclic=False, bezier=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth, data.bevel_resolution = radius, 3
    spline = data.splines.new('BEZIER' if bezier else 'POLY')
    if bezier:
        spline.bezier_points.add(len(points)-1)
        for p, co in zip(spline.bezier_points, points):
            p.co = co
            p.handle_left_type = p.handle_right_type = 'AUTO'
    else:
        spline.points.add(len(points)-1)
        for p, co in zip(spline.points, points):
            p.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return attach(obj, mat)


def grid(name, function, nu, nv, mat, solid=0):
    vertices = [function(i/nu, j/nv) for i in range(nu+1) for j in range(nv+1)]
    faces = [(i*(nv+1)+j, (i+1)*(nv+1)+j, (i+1)*(nv+1)+j+1, i*(nv+1)+j+1)
             for i in range(nu) for j in range(nv)]
    obj = mesh(name, vertices, faces, mat)
    if solid:
        mod = obj.modifiers.new('Panel thickness', 'SOLIDIFY')
        mod.thickness = solid
    return obj


def patch(name, vertices, mat, thickness=.006, radius=.004):
    # A flat n-gon would bury the middle of a fascia insert inside the crowned bumper.
    # Tessellate and project every intermediate vertex onto the same curved surface.
    front = all(v[1] < -1.8 for v in vertices)
    rear = all(v[1] > 1.8 for v in vertices)
    if front or rear:
        surface = nose_y if front else tail_y
        offset = sum(v[1]-surface(v[0],v[2]) for v in vertices)/len(vertices)
        polygon = [Vector((v[0],v[2],0)) for v in vertices]
        triangles = tessellate_polygon([polygon])
        result, faces = [], []
        divisions = 14
        for triangle in triangles:
            a,b,c = [polygon[index] for index in triangle] if isinstance(triangle[0], int) else triangle
            indices={}
            for i in range(divisions+1):
                for j in range(divisions+1-i):
                    p=a+(b-a)*(i/divisions)+(c-a)*(j/divisions)
                    indices[i,j]=len(result)
                    result.append((p.x,surface(p.x,p.y)+offset,p.y))
            for i in range(divisions):
                for j in range(divisions-i):
                    faces.append((indices[i,j],indices[i+1,j],indices[i,j+1]))
                    if i+j<divisions-1:
                        faces.append((indices[i+1,j],indices[i+1,j+1],indices[i,j+1]))
        obj=mesh(name,result,faces,mat)
        welded=bmesh.new()
        welded.from_mesh(obj.data)
        bmesh.ops.remove_doubles(welded,verts=list(welded.verts),dist=.000001)
        bmesh.ops.recalc_face_normals(welded,faces=list(welded.faces))
        welded.to_mesh(obj.data)
        welded.free()
        if thickness:
            mod=obj.modifiers.new('Fascia insert thickness','SOLIDIFY')
            mod.thickness=thickness
            mod.offset=0
        if radius:
            bevel(obj,radius,3)
        return obj
    obj = mesh(name, vertices, [tuple(range(len(vertices)))], mat, False)
    if thickness:
        mod = obj.modifiers.new('Panel thickness', 'SOLIDIFY')
        mod.thickness = thickness
    if radius:
        bevel(obj, radius, 3)
    return obj


def basis(normal):
    n = Vector(normal).normalized()
    right = Vector((0, 0, 1)).cross(n).normalized()
    up = n.cross(right)
    return right, up, n


def text(name, body, pos, size, mat, normal=(0, -1, 0), extrude=.00025):
    data = bpy.data.curves.new(name, 'FONT')
    data.body, data.size = body, size
    data.align_x, data.align_y = 'CENTER', 'CENTER'
    data.extrude, data.bevel_depth = extrude, .0001
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos
    right, up, n = basis(normal)
    obj.rotation_euler = Matrix((right, up, n)).transposed().to_euler()
    return attach(obj, mat)


def emblem(pos, radius, normal):
    center = Vector(pos)
    right, up, n = basis(normal)
    cylinder('Emblem dark backing',center-n*.001,center+n*.001,radius*1.05,piano,64)
    center+=n*.0025
    for start, end in [(17, 163), (197, 343)]:
        points = [center + radius*(math.cos(math.radians(a))*right+math.sin(math.radians(a))*up)
                  for a in range(start, end+1, 3)]
        curve('Nissan emblem open ring', points, radius*.055, chrome)
    text('Nissan wordmark', 'NISSAN', center+n*.001, radius*.37, chrome, normal)


def interpolate(stations, t):
    for a, b in zip(stations, stations[1:]):
        if t <= b[0]:
            u = max(0, min(1, (t-a[0])/(b[0]-a[0])))
            u = u*u*(3-2*u)
            return a[1]*(1-u)+b[1]*u
    return stations[-1][1]


def width(y):
    return interpolate([(-2.15,.755),(-1.75,.863),(-1.31,.88),(-.7,.851),(.35,.855),
                        (1.31,.88),(1.83,.861),(2.15,.78)], y)


def belt(y):
    return interpolate([(-2.15,.968),(-1.35,1.047),(-.78,1.087),(.45,1.09),(1.4,1.135),(2.15,1.065)], y)


def lower_edge(y):
    z = .34
    for axle in [-1.31, 1.31]:
        d = abs(y-axle)
        if d < .423:
            z = max(z, .339+math.sqrt(.423**2-d*d))
    return z


def side_x(y, z):
    # The door has a broad shoulder and a concave lower sculpted surface.
    lo = .34
    t = max(0, min(1, (z-lo)/(belt(y)-lo)))
    shaping = interpolate([(0,.972),(.15,.985),(.28,.966),(.46,.941),(.66,.975),(.86,1),(1,.984)],t)
    arch_flare=max(.028*math.exp(-((math.hypot(y-axle,z-.339)-.435)/.09)**2) for axle in [-1.31,1.31])
    return width(y)*shaping+arch_flare


def side_point(side, y, z, offset=0):
    return (side*(side_x(y,z)+offset), y, z)


def side_seam(name, side, points, radius, mat):
    path=[]
    for i in range(len(points)-1):
        a=Vector(points[max(0,i-1)])
        b=Vector(points[i])
        c=Vector(points[i+1])
        d=Vector(points[min(len(points)-1,i+2)])
        for j in range(16):
            t=j/16
            p=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            path.append(side_point(side,p.x,p.y,.004))
    path.append(side_point(side,*points[-1],.004))
    return curve(name,path,radius,mat)


for side in [-1, 1]:
    grid('Continuous sculpted body side',
         lambda u,v,s=side: side_point(s, -2.105+4.21*u, lower_edge(-2.105+4.21*u)*(1-v)+belt(-2.105+4.21*u)*v),
         200, 28, paint, .006)


def nose_y(x, z):
    return -2.152+.054*(abs(x)/.80)**3 + .012*math.exp(-((z-.77)/.12)**2)


def tail_y(x,z):
    return 2.152-.059*(abs(x)/.80)**3-.012*math.exp(-((z-.64)/.13)**2)


def bumper_cheek(name, outline, side, rear=False):
    """Build a rounded molded volume with a raised face and tapered perimeter."""
    polygon=[Vector(point) for point in outline]
    rounded=[]
    for index,point in enumerate(polygon):
        start=point*.82+polygon[index-1]*.18
        end=point*.82+polygon[(index+1)%len(polygon)]*.18
        for step in range(5):
            t=step/4
            rounded.append((1-t)**2*start+2*t*(1-t)*point+t*t*end)
    center=sum(rounded,Vector((0,0)))/len(rounded)
    surface=tail_y if rear else nose_y
    direction=1 if rear else -1
    vertices=[]
    for scale,offset in [(1,.018),(1,.026),(.91,.048),(.73,.057)]:
        for point in rounded:
            x,z=center+(point-center)*scale
            x*=side
            vertices.append((x,surface(x,z)+direction*offset,z))
    count=len(rounded)
    faces=[(ring*count+i,ring*count+(i+1)%count,(ring+1)*count+(i+1)%count,(ring+1)*count+i)
           for ring in range(3) for i in range(count)]
    x,z=center
    vertices.append((side*x,surface(side*x,z)+direction*.060,z))
    for i in range(count):
        faces.append((3*count+i,3*count+(i+1)%count,len(vertices)-1))
    obj=mesh(name,vertices,faces,bumper_silver)
    normals=bmesh.new()
    normals.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(normals,faces=list(normals.faces))
    normals.to_mesh(obj.data)
    normals.free()
    return obj


grid('Sculpted front bumper', lambda u,v: ((u*2-1)*side_x(-2.105,.3+v*.678), nose_y((u*2-1)*side_x(-2.105,.3+v*.678),.3+v*.678),.3+v*.678), 64, 32, paint, .008)
grid('Tailgate and rear quarters', lambda u,v: ((u*2-1)*side_x(2.105,.35+v*.718),tail_y((u*2-1)*side_x(2.105,.35+v*.718),.35+v*.718),.35+v*.718),64,32,paint,.008)


def hood(u,v):
    y=-2.10+v*1.20
    x=(u*2-1)*interpolate([(-2.1,.77),(-1.6,.82),(-.90,.786)],y)
    z=.979+.129*v+.028*(1-(u*2-1)**2)*math.sin(.3+v*math.pi*.75)+.009*math.exp(-((abs(u-.5)-.30)/.07)**2)
    y=nose_y(x,.979)*(1-v)-.90*v
    return x,y,z


grid('Crowned hood with shoulder creases', hood, 56, 46, paint, .008)
for side in [-1,1]:
    grid('Fender shoulder to hood join',lambda u,v,s=side:
         tuple(Vector(hood(0 if s<0 else 1,u))*(1-v)+Vector(side_point(s,hood(0 if s<0 else 1,u)[1],belt(hood(0 if s<0 else 1,u)[1])))*v),
         50,8,paint,.004)
curve('Hood shut line', [hood(u, v) for u,v in [(0,0),(0,.2),(0,.5),(0,1),(.5,1),(1,1),(1,.5),(1,.2),(1,0)]],.0018,groove,bezier=True)

active_collection='Glass and seals'


def windshield(u,v):
    w=.754*(1-v)+.638*v
    return (2*u-1)*w, -.918+.718*v-.025*(1-(2*u-1)**2),1.109+.403*v+.014*math.sin(u*math.pi)


grid('Curved front windshield',windshield,40,26,glass,.004)
for edge in [[windshield(u,0) for u in [i/40 for i in range(41)]],
             [windshield(u,1) for u in [i/40 for i in range(41)]],
             [windshield(0,v) for v in [i/26 for i in range(27)]],
             [windshield(1,v) for v in [i/26 for i in range(27)]]]:
    curve('Windshield ceramic surround',edge,.018,piano)


def backlight(u,v):
    w=.744*(1-v)+.664*v
    return (u*2-1)*w,2.04-.565*v+.02*(1-(u*2-1)**2),1.091+.391*v


grid('Rear hatch glazing',backlight,38,26,rear_glass,.004)
for side in [-1,1]:
    def window_point(y,z,s=side):
        return (s*(.832-(z-1.09)*.365),y,z)
    # Separate panes leave real A/B/C pillars and a small rear quarter light.
    outlines=[ [(-.835,1.109),(-.155,1.488),(.413,1.479),(.43,1.099)],
               [(.486,1.099),(.467,1.479),(1.095,1.462),(1.324,1.206),(1.161,1.123)],
               [(1.19,1.143),(1.363,1.228),(1.173,1.449),(1.355,1.415),(1.586,1.252)] ]
    for i,outline in enumerate(outlines):
        points=[window_point(y,z) for y,z in outline]
        patch('Front door glass' if i==0 else 'Rear side glass',points,glass if i==0 else rear_glass,.003,0)
        curve('Window rubber seal',points,.008,black,True)
    patch('Gloss B pillar',[window_point(y,z) for y,z in [(.416,1.092),(.415,1.491),(.484,1.483),(.5,1.101)]],piano,.012,.007)
    active_collection='Body panels'
    patch('Black A pillar applique',[window_point(y,z) for y,z in [(-.935,1.095),(-.81,1.111),
          (-.115,1.490),(-.22,1.537)]],piano,.015,.008)
    curve('A pillar structural edge',[window_point(-.927,1.095),window_point(-.55,1.305),window_point(-.20,1.521)],.018,piano,bezier=True)
    curve('Roof cant rail',[window_point(-.20,1.521),window_point(.55,1.519),window_point(1.14,1.498),window_point(1.43,1.405)],.021,paint,bezier=True)
    patch('Sculpted rear pillar',[window_point(y,z) for y,z in [(1.14,1.105),(1.356,1.23),(1.398,1.451),
         (1.61,1.413),(1.997,1.074),(1.57,1.108)]],paint,.028,.015)
    patch('Rear roof pillar closure',[window_point(y,z) for y,z in [(1.08,1.50),(1.48,1.526),
          (1.64,1.406),(1.40,1.445)]],paint,.018,.007)
    active_collection='Exterior details'
    # Dark diagonal garnish marks the floating rear roof in the references.
    patch('C pillar diagonal black applique',[Vector(window_point(y,z))+Vector((side*.033,0,0))
          for y,z in [(1.37,1.421),(1.45,1.427),(1.652,1.225),(1.565,1.218)]],black,.012,.006)
    for line in range(12):
        y=1.394+line*.016
        z=1.408-line*.016
        garnish=[Vector(window_point(yy,zz))+Vector((side*.041,0,0)) for yy,zz in [(y,z),(y+.051,z+.005)]]
        curve('C pillar diagonal garnish',garnish,.0016,piano)
    curve('Window belt molding',[window_point(y,z) for y,z in [(-.88,1.095),(.42,1.094),(1.17,1.116),(1.60,1.25)]],.008,black)
    active_collection='Glass and seals'

active_collection='Body panels'
grid('Compound curved roof',lambda u,v: ((u*2-1)*(.687+.008*math.sin(v*math.pi)),-.20+v*1.70,
     1.522+.028*(1-(u*2-1)**2)+.012*math.sin(v*math.pi)),42,48,paint,.018)
box('Roof trailing spoiler',(0,1.60,1.502),(1.39,.185,.054),paint,.026)
active_collection='Exterior details'
box('Spoiler dark underside',(0,1.671,1.481),(1.24,.059,.025),piano,.012)
box('High mounted brake lamp',(0,1.706,1.477),(.30,.014,.018),red_led,.006)
for side in [-1,1]:
    rail=[(side*.572,y,z) for y,z in [(.05,1.562),(.20,1.593),(.55,1.605),(1.15,1.602),(1.47,1.551)]]
    curve('Satin roof rail',rail,.016,metal,bezier=True)
    for y in [.17,1.34]:
        box('Roof rail foot',(side*.572,y,1.552),(.044,.10,.033),black,.012)
patch('Shark fin antenna',[(-.020,1.26,1.56),(.020,1.26,1.56),(0,1.31,1.625),(0,1.46,1.559)],piano,.015,.006)

# Wheel opening cladding uses real arches, rather than painting wheel silhouettes onto a solid body.
for side in [-1,1]:
    for axle in [-1.31,1.31]:
        grid('Dark wheel well liner',lambda u,v,s=side,a=axle:
             (s*(.68+.188*v),a+math.cos(math.pi*u)*.422,.339+math.sin(math.pi*u)*.422),
             64,8,black,.007)
        grid('Wheel arch molded trim',lambda u,v,s=side,a=axle:
             (s*(side_x(a+math.cos(math.pi*u)*(.365+v*.062),.339+math.sin(math.pi*u)*(.365+v*.062))+.009),
              a+math.cos(math.pi*u)*(.365+v*.062),.339+math.sin(math.pi*u)*(.365+v*.062)),80,8,black,.009)
        for direction in [-1,1]:
            box('Arch lower trim end',(side*(width(axle+direction*.397)+.007),axle+direction*.397,.325),(.042,.064,.082),black,.01)
    box('Lower sill cladding',(side*.843,0,.331),(.048,1.73,.118),black,.024)
    curve('Sill highlight',[(side*.871,y,.295) for y in [-.82,-.55,0,.5,.83]],.009,piano)
    for y in [-.58,0,.58]:
        patch('Sill inset facets',[(side*.87,y-.19,.286),(side*.87,y+.14,.286),
             (side*.89,y+.20,.327),(side*.89,y-.14,.327)],black,.006,.004)
    for points in [[(-.89,1.085),(-.80,.96),(-.72,.78),(-.64,.49),(-.53,.397)],
                   [(.454,1.092),(.46,.90),(.47,.67),(.50,.45),(.55,.397)],
                   [(1.377,1.191),(1.475,1.035),(1.38,.857),(1.115,.771),(.96,.588),(.83,.412)]]:
        side_seam('Door shut line',side,points,.0016,groove)
    for y in [.245,1.10]:
        pos=side_point(side,y,1.024,.01)
        sphere('Handle recess',pos,(.011,.105,.031),piano)
        handle=box('Body colored door handle',(pos[0]+side*.020,y,1.03),(.033,.152,.028),paint,.012)
        box('Handle key sensor',(pos[0]+side*.038,y+.039,1.034),(.003,.016,.005),piano,.001)
    # Strong but restrained lower-door character line.
    side_seam('Lower door crease',side,[(-.76,.476),(-.42,.434),(.24,.450),(.77,.534)],.0012,paint)
    # Mirror stem, two-piece housing, turn strip and reflective glass.
    cylinder('Mirror support',side_point(side,-.52,1.13), (side*.961,-.56,1.159),.023,piano)
    sphere('Mirror gloss shell',(side*.968,-.566,1.177),(.112,.101,.058),mirror_black)
    shell=box('Mirror reflection',(side*.979,-.492,1.18),(.174,.006,.077),chrome,.020)
    curve('Mirror indicator',[(side*x,y,z) for x,y,z in [(.885,-.635,1.172),(.98,-.661,1.167),(1.04,-.625,1.163)]],.0035,lens,bezier=True)

fuel_y,fuel_z=1.66,.984
curve('Fuel filler door seam',[side_point(1,fuel_y+.071*math.cos(a),fuel_z+.071*math.sin(a),.006)
      for a in [i*math.tau/80 for i in range(80)]],.0018,groove,True)

# Front fascia: thin upper optic band, stacked lower DRL modules, open lower grille.
def front_point(x,z,out=.010):
    x=math.copysign(min(abs(x),side_x(-2.105,z)+.012),x)
    return (x,nose_y(x,z)-out,z)


patch('Upper black optic bridge',[front_point(x,z) for x,z in [(-.81,.970),(-.75,.915),(.75,.915),(.81,.970)]],piano,.014,.005)
for side in [-1,1]:
    patch('Swept headlamp housing',[front_point(side*x,z,.020) for x,z in [(.425,.919),(.743,.934),(.827,1.006),(.523,.980)]],piano,.02,.005)
    patch('Headlamp reflector',[front_point(side*x,z,.026) for x,z in [(.456,.924),(.734,.937),(.784,.990),(.527,.977)]],lens,.01,.003)
    patch('Headlight black side return',[side_point(side,y,z,.008) for y,z in [(-2.10,.976),(-1.72,1.037),(-1.78,.997),(-2.10,.936)]],piano,.005,.002)
    curve('Upper LED signature',[front_point(side*x,z,.036) for x,z in [(.461,.941),(.605,.953),(.748,.968)]],.0047,led)
    for cell in range(5):
        x=.487+cell*.044
        cylinder('Headlight reflector cell',front_point(side*x,.950+cell*.004,.026),front_point(side*x,.950+cell*.004,.034),.012,chrome,24)
    shape=[(.594,.838),(.787,.853),(.785,.682),(.685,.676),(.594,.753)]
    patch('Lower DRL black pocket',[front_point(side*x,z,.018) for x,z in shape],piano,.018,.012)
    for row in range(3):
        z=.727+row*.040
        curve('Stacked daytime running light',[front_point(side*x,z,.033) for x in [.646,.692,.757]],.005,led)
    patch('Bumper diagonal gloss blade',[front_point(side*x,z,.021) for x,z in [(.51,.686),(.572,.662),(.822,.347),(.801,.268),(.745,.291)]],piano,.013,.004)
    bumper_cheek('Front silver skid cheek',[(.474,.279),(.784,.29),(.775,.345),
                 (.664,.448),(.563,.448),(.523,.372)],side)
    curve('Front skid cheek pressed ridge',[front_point(side*x,z,.058) for x,z in
          [(.529,.321),(.551,.338),(.682,.338),(.726,.315)]],.005,bumper_silver,bezier=True)

opening=[(-.513,.717),(-.645,.605),(-.700,.316),(.700,.316),(.645,.605),(.513,.717)]
patch('Deep lower radiator opening',[front_point(x,z,.014) for x,z in opening],groove,.015,.012)
for row in range(6):
    z=.35+row*.060
    half=.676-(z-.35)*.36
    curve('Radiator horizontal louver',[front_point(x,z,.027) for x in [-half,-half*.5,0,half*.5,half]],.0085,black)
    if row in [1,3,5]:
        for side in [-1,1]:
            curve('Grille raised end detail',[front_point(side*x,z+.012,.039) for x in [.32,half*.96]],.007,black)
for x in [-.44,-.22,0,.22,.44]:
    curve('Radiator vertical vane',[front_point(x,z,.022) for z in [.34,.50,.68]],.006,black)
box('Front number plate support',(0,-2.180,.595),(.407,.018,.186),piano,.018)
box('Front display plate',(0,-2.191,.599),(.373,.008,.164),white,.012)
text('Front model plate','KAIT',(0,-2.197,.599),.045,black)
emblem((0,-2.18,.957),.046,(0,-1,0))
curve('Front lower silver lip',[front_point(x,.269,.015) for x in [-.69,-.4,0,.4,.69]],.013,metal,bezier=True)


def rear_point(x,z,out=.009):
    x=math.copysign(min(abs(x),side_x(2.105,z)+.010),x)
    return x,tail_y(x,z)+out,z


patch('Rear black lamp bridge',[rear_point(x,z) for x,z in [(-.81,1.101),(.81,1.101),(.77,.994),(-.77,.994)]],piano,.014,.006)
for side in [-1,1]:
    patch('Rear lamp lens',[rear_point(side*x,z,.017) for x,z in [(.42,1.078),(.80,1.089),(.811,.988),(.563,.98),(.51,1.007)]],lens,.010,.007)
    for row in range(2):
        curve('Tail LED horizontal blade',[rear_point(side*x,1.012+row*.047,.030) for x in [.57,.66,.785]],.006,red_led)
    curve('Tail lamp inner red accent',[rear_point(side*x,1.06,.029) for x in [.38,.48,.565]],.005,red_led)
    patch('Rear lamp wraparound',[side_point(side,y,z,.010) for y,z in [(1.72,1.115),(2.08,1.079),(2.08,.992),(1.81,1.042)]],piano,.008,.005)
    curve('Rear side red lens',[side_point(side,y,z,.024) for y,z in [(1.77,1.079),(1.94,1.052),(2.07,1.04)]],.007,red)
    curve('Tailgate shut line',[rear_point(side*x,z,.006) for x,z in [(.684,1.094),(.683,.89),(.671,.65),(.593,.53),(.15,.507)]],.0018,groove,bezier=True)
patch('Rear bumper black lower section',[rear_point(x,z,.014) for x,z in [(-.828,.49),(-.67,.57),(.67,.57),(.828,.49),(.814,.265),(-.814,.265)]],black,.018,.015)
for side in [-1,1]:
    bumper_cheek('Rear silver diffuser cheek',[(.39,.30),(.790,.30),(.765,.408),(.628,.505),(.425,.506)],side,True)
    patch('Rear red reflector',[rear_point(side*x,z,.060) for x,z in [(.448,.335),(.719,.335),(.698,.368),(.481,.369)]],red,.006,.005)
    curve('Rear diffuser pressed ridge',[rear_point(side*x,z,.060) for x,z in
          [(.435,.314),(.439,.399),(.637,.411),(.728,.375)]],.006,bumper_silver,bezier=True)
    cylinder('Rear parking sensor',rear_point(side*.35,.466,.03),rear_point(side*.35,.466,.034),.009,piano,24)
box('Rear display plate support',(0,2.184,.385),(.48,.025,.202),piano,.017)
box('Rear display plate',(0,2.201,.386),(.37,.008,.148),white,.012)
text('Rear model plate','KAIT',(0,2.208,.386),.04,black,(0,1,0))
for i,char in enumerate('KAIT'):
    text('Tailgate model lettering',char,((1.5-i)*.175,2.163,.902),.059,chrome,(0,1,0),.0015)
emblem((0,2.18,1.055),.049,(0,1,0))
box('Tailgate release recess',(0,2.172,.739),(.247,.013,.047),black,.015)
box('Tailgate handle highlight',(0,2.183,.728),(.194,.012,.011),paint,.005)
cylinder('Exhaust outer',(-.60,1.95,.244),(-.60,2.19,.244),.036,steel)
cylinder('Exhaust dark bore',(-.60,2.19,.244),(-.60,2.194,.244),.028,groove)
def on_rear_glass(x,z):
    v=(z-1.091)/.391
    w=.744*(1-v)+.664*v
    return x,2.04-.565*v+.02*(1-(x/w)**2)+.012,z


curve('Rear wiper arm',[on_rear_glass(x,z) for x,z in [(.25,1.139),(0,1.17),(-.14,1.195)]],.007,black,bezier=True)
curve('Rear wiper blade',[on_rear_glass(x,z) for x,z in [(-.26,1.20),(-.06,1.204),(.15,1.206)]],.006,black,bezier=True)
for row in range(11):
    curve('Rear window heater trace',[backlight(u,.14+row*.067) for u in [i/30 for i in range(2,29)]],.00045,steel)
for side in [-1,1]:
    curve('Front wiper arm',[(side*.23,-.909,1.128),(side*.43,-.845,1.160),(side*.61,-.799,1.174)],.0045,black)
    curve('Front wiper blade',[(side*.24,-.815,1.179),(side*.46,-.80,1.183),(side*.68,-.779,1.184)],.005,black,bezier=True)

active_collection='Wheels'


def lathe_x(name, center, profile, mat, segments=112):
    x,y,z=center
    verts=[(x+offset,y+radius*math.cos(i*math.tau/segments),z+radius*math.sin(i*math.tau/segments))
           for offset,radius in profile for i in range(segments)]
    faces=[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i)
           for j in range(len(profile)-1) for i in range(segments)]
    return mesh(name,verts,faces,mat)


def spoke(side, axle, angle):
    x=side*.886
    def p(r,a,depth=0):
        a=angle+math.radians(a)
        return x+side*depth,axle+r*math.sin(a),.339+r*math.cos(a)
    polygon=[p(.046,-24),p(.092,24),p(.196,36),p(.216,23),p(.207,-16),p(.091,-24)]
    patch('Five broad black wheel blades',polygon,wheel_black,.020,.006)
    patch('Diamond cut spoke broad edge',[p(.065,-20,.012),p(.193,-17,.012),p(.212,-5,.012),
          p(.204,5,.012),p(.126,0,.012),p(.080,7,.012)],metal,.005,.002)
    patch('Diamond cut spoke outer tip',[p(.143,18,.014),p(.197,33,.014),p(.215,22,.014),p(.176,5,.014)],metal,.004,.002)


for side in [-1,1]:
    for axle in [-1.31,1.31]:
        center=(side*.765,axle,.339)
        profile=[(-.10,.22),(-.111,.259),(-.106,.299),(-.084,.328),(-.056,.338),
                 (.056,.338),(.084,.328),(.106,.299),(.111,.259),(.10,.22)]
        lathe_x('Tire rounded shoulder',center,profile,rubber)
        for offset in [-.058,-.019,.019,.058]:
            lathe_x('Circumferential tread groove',center,[(offset-.0018,.3383),(offset+.0018,.3383)],groove)
        # Fine transverse channels follow the tread surface as geometry.
        vertices,faces=[],[]
        for i in range(96):
            a=i*math.tau/96
            for column in [-1,0,1]:
                o=column*.041
                base=len(vertices)
                for dx,da in [(-.016,-.005),(.016,.017),(.016,.024),(-.016,.002)]:
                    vertices.append((center[0]+o+dx,axle+.3385*math.cos(a+da),.339+.3385*math.sin(a+da)))
                faces.append(tuple(range(base,base+4)))
        mesh('Tire transverse tread channels',vertices,faces,groove)
        for radius in [.232,.283,.310]:
            lathe_x('Raised sidewall bead',(side*.875,axle,.339),[(0,radius-.001),(.0015*side,radius), (0,radius+.001)],rubber)
        lathe_x('Alloy rim barrel',(side*.853,axle,.339),[(side*-.06,.209),(side*.026,.217),(side*.035,.214),(side*.031,.204)],metal)
        cylinder('Brake rotor',(side*.831,axle,.339),(side*.84,axle,.339),.173,steel,80)
        cylinder('Hub dark backing',(side*.842,axle,.339),(side*.848,axle,.339),.079,piano)
        box('Brake caliper',(side*.851,axle+.13,.38),(.032,.054,.110),black,.014)
        for i in range(5):
            spoke(side,axle,i*math.tau/5)
            a=i*math.tau/5
            y,z=axle+.041*math.sin(a),.339+.041*math.cos(a)
            cylinder('Lug recess',(side*.886,y,z),(side*.892,y,z),.0105,piano,24)
            cylinder('Hexagonal wheel nut',(side*.892,y,z),(side*.899,y,z),.007,chrome,6)
        cylinder('Center cap',(side*.886,axle,.339),(side*.901,axle,.339),.03,piano,48)
        emblem((side*.905,axle,.339),.021,(side,0,0))
        text('Embossed tire size','215/60 R17',(side*.878,axle,.623),.013,rubber,(side,0,0),.0008)

active_collection='Cabin'
box('Underfloor',(0,0,.289),(1.49,3.55,.073),black,.02)
box('Carpet floor',(0,.62,.375),(1.48,2.56,.05),cloth,.016)

# A dashboard with distinct top, passenger insert, instrument binnacle and center stack.
grid('Dashboard upper sculpted pad',lambda u,v: ((u*2-1)*.76,-.76+v*.58,
     1.115-.045*v+.009*math.sin(u*math.pi)),52,24,dash,.045)
dash_face=box('Dashboard structural lower pad',(0,-.23,.872),(1.47,.20,.35),dash,.078)
box('Continuous padded fascia insert',(0,-.117,.897),(1.34,.029,.196),insert,.025)
box('Glovebox',( -.43,-.097,.715),(.49,.075,.17),dash,.028)
box('Glovebox pull',(-.41,-.053,.761),(.10,.011,.022),black,.008)
curve('Dashboard stitched seam',[(x,-.09,.800+.007*math.cos(x*4)) for x in [i*.012- .70 for i in range(118)]],.0007,thread)


def cabin_panel(name, center, size, mat, radius=.007):
    return box(name,center,size,mat,radius)


def vent(x,z,width_m):
    cabin_panel('Vent black bezel',(x,-.085,z),(width_m+.018,.055,.079),dash,.016)
    cabin_panel('Vent dark recess',(x,-.052,z),(width_m,.005,.063),groove,.010)
    for row in range(3):
        cabin_panel('Vent horizontal vane',(x,-.048,z-.021+row*.021),(width_m-.014,.004,.004),black,.0015)
    cabin_panel('Vent blade silver edge',(x,-.044,z+.001),(width_m-.017,.002,.002),metal,.0008)
    cabin_panel('Vent direction tab',(x-.016,-.041,z),( .028,.006,.009),metal,.003)


# The fascia surrounds the binnacle; a full-width beam would occlude its display.
cabin_panel('Passenger and center vent fascia',(-.2675,-.105,1.002),(.945,.110,.137),dash,.022)
cabin_panel('Driver outer vent fascia',(.670,-.105,1.002),(.160,.110,.137),dash,.022)
cabin_panel('Instrument lower fascia',(.405,-.105,.935),(.420,.110,.028),dash,.011)
for x,z,w in [(.659,.991,.14),(-.656,.991,.14),(-.005,1.006,.155),(-.22,1.006,.155)]:
    vent(x,z,w)
cabin_panel('Hazard button',(-.11,-.051,1.006),(.038,.014,.050),piano,.006)
text('Hazard warning triangle','△',(-.11,-.042,1.009),.018,red,(0,1,0))
screen_x=-.11
cabin_panel('Center multimedia satin frame',(screen_x,-.064,.855),(.365,.04,.236),piano,.026)
cabin_panel('Center multimedia glass',(screen_x,-.039,.858),(.324,.009,.195),screen,.013)
cabin_panel('Center display illuminated area',(screen_x,-.032,.86),(.291,.003,.16),blue,.006)
text('Display clock','09:41',(screen_x,-.028,.899),.024,white,(0,1,0))
text('Display title','NISSAN KAIT',(screen_x,-.028,.865),.016,white,(0,1,0))
text('Display status','Listo para conducir',(screen_x,-.028,.828),.011,white,(0,1,0))
for x in [screen_x-.172,screen_x+.172]:
    for z in [.80,.84,.88]:
        text('Display capacitive marker','•',(x,-.035,z),.013,white,(0,1,0))
cabin_panel('HVAC control glossy surround',(screen_x,-.015,.681),(.34,.04,.111),piano,.035)
cabin_panel('HVAC blue display',(screen_x,.009,.693),(.103,.008,.039),blue,.005)
text('Climate readout','18°  AUTO',(screen_x,.015,.694),.014,white,(0,1,0))
for x in [screen_x-.117,screen_x+.117]:
    cylinder('Knurled HVAC bezel',(x,-.009,.685),(x,.027,.685),.033,chrome,64)
    cylinder('HVAC rubber knob',(x,.016,.685),(x,.036,.685),.029,black,64)
    text('HVAC knob label','AUTO' if x>screen_x else 'A/C',(x,.038,.685),.009,white,(0,1,0))
    for i in range(36):
        a=i*math.tau/36
        cylinder('Climate knob knurl',(x+.032*math.sin(a),.010,.685+.032*math.cos(a)),
                 (x+.032*math.sin(a),.025,.685+.032*math.cos(a)),.0007,black,8)
for i,body in enumerate(['OFF','↟','↟','↺']):
    x=screen_x+.065-i*.043
    cabin_panel('Climate function switch',(x,.018,.648),(.037,.011,.016),black,.003)
    text('Climate function label',body,(x,.025,.648),.0075,white,(0,1,0))

# Instrument binnacle and virtual display. The graphics are modeled, not copied pixels.
driver_x=.405
cabin_panel('Instrument hood',(driver_x,-.178,1.044),(.406,.13,.226),dash,.044)
cabin_panel('Instrument black surround',(driver_x,-.100,1.039),(.361,.018,.178),piano,.026)
cabin_panel('Instrument display',(driver_x,-.088,1.042),(.318,.007,.141),screen,.017)
cabin_panel('Left information display',(driver_x+.098,-.082,1.042),(.075,.003,.115),blue,.005)
text('Instrument time','09:41',(driver_x+.099,-.078,1.084),.010,white,(0,1,0))
text('Speed numeral','0',(driver_x-.010,-.078,1.057),.055,white,(0,1,0))
text('Speed units','km/h',(driver_x-.010,-.078,1.024),.013,white,(0,1,0))
text('Selected transmission','P',(driver_x-.112,-.078,1.048),.027,white,(0,1,0))
text('Instrument distance','00013 km',(driver_x,-.078,.992),.010,white,(0,1,0))
cabin_panel('Cluster car silhouette',(driver_x+.10,-.076,1.039),(.021,.004,.045),white,.006)
for x in [driver_x+.085,driver_x+.115]:
    for z in [1.025,1.052]:
        cabin_panel('Cluster car tires',(x,-.073,z),(.007,.002,.010),black,.001)

# Steering wheel is a flattened circle, with leather rim, three spokes and button clusters.
center=Vector((driver_x,.097,.917))
right,up,normal=basis((0,.958,.287))


def wheel_point(u,v,depth=0):
    return center+right*u+up*v+normal*depth


points=[]
for i in range(160):
    angle=i*math.tau/160
    u=.179*math.cos(angle)
    v=max(-.151,.179*math.sin(angle))
    points.append(wheel_point(u,v))
curve('Leather D shaped steering rim',points,.0185,leather,True)
for i in range(100):
    angle=i*math.tau/100
    u=.164*math.cos(angle)
    v=max(-.141,.164*math.sin(angle))
    tangent=right*(-math.sin(angle)) + up*math.cos(angle)
    p=wheel_point(u,v,.007)
    curve('Steering rim stitching',[p-tangent*.0017,p+tangent*.0017],.00055,thread)
for side in [-1,1]:
    patch('Steering horizontal spoke',[wheel_point(side*u,v,d) for u,v,d in [(.04,.035,0),(.164,.013,0),(.146,-.062,0),(.07,-.06,.016)]],piano,.016,.009)
    curve('Steering spoke satin edging',[wheel_point(side*u,v,.013) for u,v in [(.075,-.050),(.142,-.058),(.16,-.022)]],.004,metal,bezier=True)
    for row in range(2):
        for column in range(2):
            p=wheel_point(side*(.102+column*.026),-.015+row*.023,.020)
            button=box('Steering multifunction button',p,(.022,.012,.016),black,.004)
            button.rotation_euler=Matrix((right,normal,up)).transposed().to_euler()
            text('Steering button symbol','+' if row else '−',p+normal*.009,.008,white,normal)
patch('Steering lower spoke',[wheel_point(u,v,.002) for u,v in [(-.060,-.025),(.060,-.025),(.038,-.144),(-.038,-.144)]],piano,.016,.005)
curve('Lower spoke silver outline',[wheel_point(u,v,.016) for u,v in [(-.053,-.055),(-.032,-.138),(.032,-.138),(.053,-.055)]],.003,metal)
hub=sphere('Airbag hub',center+normal*.018,(.090,.052,.075),leather)
hub.rotation_euler[0]=.291
emblem(center+normal*.083+up*.006,.032,normal)
text('Airbag lettering','SRS AIRBAG',center+normal*.071-up*.035,.006,black,normal)
for side in [-1,1]:
    cylinder('Steering column stalk',(driver_x+side*.07,-.025,.95),(driver_x+side*.19,-.07,.96),.012,black)
    text('Stalk markings','AUTO',(driver_x+side*.16,-.043,.972),.007,white,(0,1,.2))
cylinder('Steering column',(driver_x,-.19,.86),center-normal*.040,.043,black)

# Center tunnel and CVT selector follow the supplied cabin views.
console=box('Center console tunnel',(0,.36,.43),(.263,.93,.19),dash,.045)
console.rotation_euler[0]=.055
box('Selector gloss surround',(-.04,.155,.547),(.21,.37,.025),piano,.038)
box('Selector satin frame',(-.04,.155,.562),(.178,.31,.008),chrome,.026)
box('Selector gate',(-.045,.155,.568),(.149,.281,.009),piano,.020)
curve('Selector leather gaiter',[(-.06,.035,.58),(-.12,.08,.565),(-.12,.25,.565),(-.02,.29,.565),(.025,.11,.565)],.016,leather,True,True)
cylinder('Gear selector shaft',(-.055,.07,.568),(-.055,.077,.664),.018,chrome)
gear=sphere('CVT selector leather grip',(-.055,.079,.683),(.037,.046,.052),leather)
curve('Selector silver accent',[(-.018,.045,.65),(-.018,.055,.714),(-.055,.093,.727),(-.087,.11,.683)],.004,metal,bezier=True)
for i,char in enumerate('PRNDL'):
    obj=text('Selector gear legend',char,(.027,.03+i*.045,.577),.011,white,(0,1,.05))
    obj.rotation_euler=(0,0,math.pi)
for y in [.46,.59]:
    cylinder('Cupholder rim',(0,y,.52),(0,y,.529),.054,piano,64)
    cylinder('Cupholder dark well',(0,y,.529),(0,y,.531),.046,groove,64)
box('Center armrest',(0,.82,.60),(.24,.33,.105),leather,.039)
box('Console USB recess',(-.12,-.06,.585),(.083,.029,.040),black,.008)
for x in [-.145,-.10]:
    box('USB metal slot',(x,-.039,.589),(.024,.006,.009),metal,.002)

# Upholstered front seats, rear bench, headrests, buckles and door cards.
for side in [-1,1]:
    x=side*.435
    box('Front seat cushion',(x,.57,.485),(.424,.493,.139),leather,.05)
    box('Front cushion fabric insert',(x,.53,.558),(.289,.363,.021),cloth,.01)
    for bolster_side in [-1,1]:
        sphere('Front cushion side bolster',(x+bolster_side*.178,.57,.547),(.047,.235,.046),leather)
    back=box('Front seat backrest',(x,.85,.89),(.41,.144,.595),leather,.058)
    back.rotation_euler[0]=math.radians(10)
    panel=box('Front backrest fabric insert',(x,.765,.90),(.286,.025,.440),cloth,.012)
    panel.rotation_euler[0]=math.radians(10)
    for b in [-1,1]:
        bolster=sphere('Backrest lateral bolster',(x+b*.17,.765,.89),(.047,.069,.255),leather)
        bolster.rotation_euler[0]=math.radians(10)
        curve('Seat back stitching',[(x+b*.14,.706,z) for z in [.67,.79,.93,1.07]],.0008,thread)
    for b in [-1,1]:
        cylinder('Headrest polished support',(x+b*.065,.913,1.12),(x+b*.065,.928,1.243),.006,chrome)
    head=box('Front headrest',(x,.934,1.271),(.249,.154,.215),leather,.05)
    head.rotation_euler[0]=math.radians(10)
    box('Belt buckle',(x-side*.215,.65,.51),(.034,.065,.07),black,.008)
    box('Buckle release',(x-side*.215,.65,.548),(.027,.039,.008),red,.003)
    box('Front footwell carpet mat',(x,-.07,.408),(.36,.53,.011),cloth,.02)
    for y in [-.18,-.10,-.02,.06]:
        box('Carpet molded rib',(x,y,.417),(.27,.008,.004),rubber,.001)
    # Door cards deliberately remain separate editable pieces.
    box('Door inner trim',(side*.735,.09,.766),(.055,1.04,.37),dash,.041)
    box('Door padded insert',(side*.701,.16,.859),(.035,.56,.111),insert,.025)
    box('Door armrest',(side*.674,.14,.739),(.10,.47,.058),leather,.02)
    box('Interior handle surround',(side*.699,-.11,.924),(.025,.17,.056),piano,.014)
    curve('Interior door handle',[(side*.678,y,z) for y,z in [(-.17,.92),(-.12,.938),(-.045,.936)]],.009,chrome,bezier=True)
    box('Window switch bank',(side*.674,-.01,.773),(.071,.17,.016),piano,.007)
    for y in [-.055,.015]:
        box('Window rocker',(side*.674,y,.785),(.043,.040,.012),black,.004)
    cylinder('Door speaker grille',(side*.688,.39,.631),(side*.681,.39,.631),.071,black,64)
    for line in range(9):
        z=.58+line*.013
        length=math.sqrt(max(.065**2-(z-.631)**2,0))
        curve('Speaker grille horizontal slot',[(side*.676,.39-length,z),(side*.676,.39+length,z)],.0011,groove)
    cylinder('Seatbelt upper anchor',(side*.73,.46,1.32),(side*.70,.46,1.32),.022,black)
    curve('Retracted seatbelt',[(side*.705,.47,1.32),(side*.716,.50,.86),(side*.65,.60,.44)],.011,black)
    box('Rear seat cushion',(side*.35,1.44,.506),(.67,.44,.12),leather,.045)
    back=box('Rear seat backrest',(side*.35,1.714,.856),(.68,.15,.56),cloth,.045)
    back.rotation_euler[0]=.13
    box('Rear headrest',(side*.43,1.744,1.205),(.22,.14,.17),leather,.035)

for x,y,z,w in [(driver_x+.08,-.51,.445,.055),(driver_x-.075,-.55,.433,.10)]:
    pedal=box('Pedal rubber pad',(x,y,z),(w,.05,.074),rubber,.008)
    pedal.rotation_euler[0]=-.35
    for row in range(4):
        curve('Pedal grip rib',[(x-w*.38,y+.028,z-.023+row*.014),(x+w*.38,y+.028,z-.023+row*.014)],.002,groove)

box('Interior rear view mirror',(0,-.448,1.392),(.229,.038,.064),black,.019)
box('Interior mirror reflective face',(0,-.425,1.393),(.209,.003,.048),chrome,.012)
cylinder('Interior mirror mounting',(0,-.39,1.44),(0,-.459,1.397),.010,black)
for side in [-1,1]:
    visor=box('Folded sun visor',(side*.374,.03,1.488),(.32,.155,.031),dash,.014)
    visor.rotation_euler[0]=.06
box('Overhead lamp console',(0,.2,1.489),(.17,.20,.027),dash,.013)
box('Overhead lamp lens',(0,.2,1.471),(.108,.103,.009),lens,.008)

# Organize an asset root separately from the studio cameras and lights.
root=bpy.data.objects.new('KAIT | editable vehicle assembly',None)
collections['Body panels'].objects.link(root)
for collection_name,collection in collections.items():
    if collection_name!='Studio':
        for obj in list(collection.objects):
            if obj!=root:
                obj.parent=root
root['reference_count']=7
root['nominal_length_m']=4.304
root['nominal_width_m']=1.760
root['nominal_height_m']=1.611
root['wheelbase_m']=2.620
root['model_status']='Original visual reconstruction from photographs; not manufacturer CAD'

active_collection='Studio'
floor_mat=material('Studio neutral graphite',(.075,.094,.116),.41,.12)
box('Studio floor',(0,0,-.057),(2000,2000,.10),floor_mat,.001)
cove_profile=[(11+3*math.sin(i*math.pi/48),-.007+3*(1-math.cos(i*math.pi/48))) for i in range(25)]
cove_profile += [(14,9),(14,25)]
cove_vertices=[(r*math.cos(i*math.tau/128),r*math.sin(i*math.tau/128),z) for r,z in cove_profile for i in range(128)]
cove_faces=[(row*128+i,row*128+(i+1)%128,(row+1)*128+(i+1)%128,(row+1)*128+i)
            for row in range(len(cove_profile)-1) for i in range(128)]
mesh('Seamless studio cyclorama',cove_vertices,cove_faces,floor_mat)
scene.world.use_nodes=True
world_bg=scene.world.node_tree.nodes.get('Background')
world_bg.inputs['Color'].default_value=(.32,.39,.49,1)
world_bg.inputs['Strength'].default_value=.34


def area(name,pos,target,power,size,color,size_y=None):
    data=bpy.data.lights.new(name,'AREA')
    data.energy,data.shape,data.size,data.color=power,'RECTANGLE',size,color
    data.size_y=size_y or size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    obj.visible_camera=False
    obj.visible_transmission=False
    attach(obj)
    return obj


area('Key softbox',(3.2,-4.3,5.3),(0,0,.7),1100,4.8,(1,.91,.81),2.4)
area('Cool fill softbox',(-4.0,-.9,3.2),(0,0,.8),700,4.6,(.75,.86,1),2.1)
area('Roof strip',(0,1.2,5.0),(0,0,0),1000,4.3,(1,1,1),1.2)
area('Rear edge strip',(3.0,4.1,3.7),(0,.4,.8),900,3.7,(.88,.94,1),1.5)
area('Front fascia softbox',(-.2,-5.0,1.4),(0,-1,.6),280,3.4,(1,.97,.93),1.0)
interior_lights=[area('Cabin overhead soft fill',(.05,.55,1.46),(0,-.3,.72),6,.65,(1,.94,.86),.42),
                 area('Cabin window fill',(.98,.25,1.4),(0,-.25,.80),8,.6,(.79,.89,1),.55),
                 area('Cabin camera softbox',(.1,.75,1.23),(.1,-.22,.84),12,.70,(1,.97,.92),.6)]
for light in interior_lights:
    light.hide_render=True

views={
    'front': ((5.1,-6.6,2.16),(0,-.05,.81),55),
    'rear': ((4.9,6.5,2.72),(0,.12,.83),55),
    'side': ((8.8,.1,2.05),(0,0,.80),57),
    'interior': ((.43,.62,1.41),(.02,-.36,.905),23),
}
cameras={}
for name,(pos,target,lens_mm) in views.items():
    data=bpy.data.cameras.new(name)
    data.lens=lens_mm
    data.clip_start=.015
    data.clip_end=300
    obj=bpy.data.objects.new('Camera '+name,data)
    scene.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    attach(obj)
    cameras[name]=obj
scene.render.engine='CYCLES'
scene.cycles.samples=32 if args.draft else 160
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transparent_max_bounces=10
scene.cycles.transmission_bounces=6
scene.cycles.seed=1303
prefs=bpy.context.preferences.addons['cycles'].preferences
configure_cycles_device(scene, prefs)
scene.render.resolution_x=1000 if args.draft else 1800
scene.render.resolution_y=680 if args.draft else 1224
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.film_transparent=False
scene.camera=cameras['front']

# Geometric audit records the actual evaluated mesh, not just primitive counts.
depsgraph=bpy.context.evaluated_depsgraph_get()
triangles=0
object_count=0
bounds_min=Vector((math.inf,math.inf,math.inf))
bounds_max=Vector((-math.inf,-math.inf,-math.inf))
for obj in root.children:
    if obj.type in {'MESH','CURVE','FONT'}:
        evaluated=obj.evaluated_get(depsgraph)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        triangles+=len(data.loop_triangles)
        object_count+=1
        if any(not math.isfinite(value) for vertex in data.vertices for value in vertex.co):
            raise ValueError(f'Non-finite geometry in {obj.name}')
        for vertex in data.vertices:
            world_vertex=obj.matrix_world@vertex.co
            for axis in range(3):
                bounds_min[axis]=min(bounds_min[axis],world_vertex[axis])
                bounds_max[axis]=max(bounds_max[axis],world_vertex[axis])
        evaluated.to_mesh_clear()
report={'reference_images':7,'objects':object_count,'evaluated_triangles':triangles,
        'wheelbase_m':2.620,'nominal_dimensions_m':[4.304,1.760,1.611],
        'measured_bounds_xyz_m':[round(value,4) for value in bounds_max-bounds_min],
        'bounds_note':'Includes mirrors, aerial, lamp inserts and lettering; nominal dimensions are the reference target',
        'renderer':'Cycles','device':scene.cycles.device,'samples':scene.cycles.samples,
        'status':'Photographic approximation; independent asset preview, not integrated into the game'}
(args.output/'model-report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(args.output/'kait.blend'))
print('KAIT_MODEL_REPORT',json.dumps(report),flush=True)
for name in ([] if args.skip_renders else args.views.split(',')):
    if name not in cameras:
        raise ValueError(f'Unknown view: {name}')
    scene.camera=cameras[name]
    interior=name=='interior'
    for light in interior_lights:
        light.hide_render=not interior
    for name_to_hide in ['Key softbox','Front fascia softbox']:
        bpy.data.objects[name_to_hide].hide_render=interior
    scene.view_settings.exposure=.0 if interior else -.2
    scene.render.filepath=str(args.output/f'kait-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('KAIT_RENDER_COMPLETE',name,flush=True)
scene.camera=cameras['front']
scene.view_settings.exposure=-.2
scene.render.filepath=str(args.output/'kait-front.png')
for light in interior_lights:
    light.hide_render=True
for name_to_restore in ['Key softbox','Front fascia softbox']:
    bpy.data.objects[name_to_restore].hide_render=False
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active=root
for screen_layout in bpy.data.screens:
    for area_layout in screen_layout.areas:
        if area_layout.type=='VIEW_3D':
            area_layout.spaces.active.region_3d.view_location=(0,0,.81)
            area_layout.spaces.active.region_3d.view_distance=7
            area_layout.spaces.active.region_3d.view_rotation=cameras['front'].rotation_euler.to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=str(args.output/'kait.blend'))
