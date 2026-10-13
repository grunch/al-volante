"""Exercise device selection without requiring Blender or a GPU on the runner."""

from types import SimpleNamespace
import unittest
from unittest.mock import Mock, PropertyMock, patch

from render_device import configure_cycles_device


class RenderDeviceTest(unittest.TestCase):
    def setUp(self):
        self.scene = SimpleNamespace(cycles=SimpleNamespace(device='GPU'))
        self.preferences = Mock()
        self.preferences.devices = []

    def test_missing_optix_backend_falls_back_before_device_discovery(self):
        with patch.object(type(self.preferences), 'compute_device_type',
                          new_callable=PropertyMock, create=True,
                          side_effect=TypeError('OptiX is not an accepted enum value')):
            configure_cycles_device(self.scene, self.preferences)
        self.assertEqual(self.scene.cycles.device, 'CPU')
        self.preferences.get_devices.assert_not_called()

    def test_device_discovery_failure_keeps_cpu_available(self):
        self.preferences.get_devices.side_effect = RuntimeError('Driver unavailable')
        configure_cycles_device(self.scene, self.preferences)
        self.assertEqual(self.scene.cycles.device, 'CPU')

    def test_supported_backend_without_devices_keeps_cpu(self):
        configure_cycles_device(self.scene, self.preferences)
        self.assertEqual(self.scene.cycles.device, 'CPU')

    def test_non_optix_hardware_selects_only_cpu(self):
        cpu = SimpleNamespace(type='CPU', use=False)
        hip = SimpleNamespace(type='HIP', use=True)
        self.preferences.devices = [cpu, hip]
        configure_cycles_device(self.scene, self.preferences)
        self.assertEqual(self.scene.cycles.device, 'CPU')
        self.assertTrue(cpu.use)
        self.assertFalse(hip.use)

    def test_optix_hardware_selects_gpu_without_enabling_cpu(self):
        cpu = SimpleNamespace(type='CPU', use=True)
        gpu = SimpleNamespace(type='OPTIX', use=False)
        self.preferences.devices = [cpu, gpu]
        configure_cycles_device(self.scene, self.preferences)
        self.assertEqual(self.scene.cycles.device, 'GPU')
        self.assertFalse(cpu.use)
        self.assertTrue(gpu.use)


if __name__ == '__main__':
    unittest.main()
