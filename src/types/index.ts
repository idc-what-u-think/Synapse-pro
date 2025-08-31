import { Game, PlayStyle, ExperienceLevel, FingerCount } from './gameEnums';

export interface DeviceInfo {
  name: string;
  screenSize: number;
  refreshRate: number;
  touchSamplingRate: number;
  processorScore: number;
  gpuScore: number;
  releaseYear: number;
}

export interface SensitivitySettings {
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  sniperScope: number;
  freeLook: number;
}

export interface CODMGameMode {
  cameraFpp: number;
  steeringSensitivity: number;
  verticalTurningSensitivity: number;
  thirdPersonSensitivity?: number;
  redDot: number;
  adsSensitivity: number;
  tacticalScope: number;
  scope3x: number;
  scope4x: number;
  scope6x: number;
  scope8x: number;
  sniperScope: number;
  firingCameraFpp: number;
  firingSteeringSensitivity: number;
  firingVerticalTurningSensitivity: number;
  firingRedDot: number;
  firingAdsSensitivity: number;
  firingTacticalScope: number;
  firingScope3x: number;
  firingScope4x: number;
  firingScope6x: number;
  firingScope8x: number;
  firingSniperScope: number;
  firingThirdPersonSensitivity?: number;
}

export interface CODMSensitivitySettings {
  mp: CODMGameMode;
  br: CODMGameMode;
}
