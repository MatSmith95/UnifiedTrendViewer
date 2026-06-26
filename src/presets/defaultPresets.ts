import type { TrendPreset } from '../types/trend';

export function buildDefaultPresets(): TrendPreset[] {
  return [
    {
      id: 'Hydraulics',
      name: 'Hydraulics',
      description: 'Hydraulic pressures and flows',
      tagNames: ['Vehicle_HP_Pressure', 'Vehicle_LP_Pressure', 'Vehicle_LP_Flow'],
    },
    {
      id: 'Jetting',
      name: 'Jetting',
      description: 'Jetting pressure trends',
      tagNames: ['Jetting_Pressure'],
    },
    {
      id: 'Pumps',
      name: 'Pumps',
      description: 'Pump and hydraulic load indicators',
      tagNames: ['Vehicle_HP_Pressure', 'Vehicle_LP_Flow'],
    },
    {
      id: 'Steering',
      name: 'Steering',
      description: 'Track steering speeds',
      tagNames: ['Track_Left_Speed', 'Track_Right_Speed'],
    },
    {
      id: 'Cutter',
      name: 'Cutter',
      description: 'Cutter speed and jetting interaction',
      tagNames: ['Cutter_Speed', 'Jetting_Pressure'],
    },
    {
      id: 'Thrusters',
      name: 'Thrusters',
      description: 'Thruster and track motion indicators',
      tagNames: ['Track_Left_Speed', 'Track_Right_Speed'],
    },
    {
      id: 'Custom',
      name: 'Custom',
      description: 'Operator-selected tag set',
      tagNames: [],
    },
  ];
}
