"""Choose an available Cycles device without requiring an NVIDIA backend."""


def configure_cycles_device(scene, preferences):
    """Prefer OptiX when detected; keep CPU rendering usable on other builds."""
    scene.cycles.device = 'CPU'
    try:
        preferences.compute_device_type = 'OPTIX'
        preferences.get_devices()
    except (TypeError, ValueError, RuntimeError) as error:
        print(f'OptiX unavailable; using CPU: {error}', flush=True)
        return

    has_optix = any(device.type == 'OPTIX' for device in preferences.devices)
    for device in preferences.devices:
        device.use = device.type == ('OPTIX' if has_optix else 'CPU')
    if has_optix:
        scene.cycles.device = 'GPU'
