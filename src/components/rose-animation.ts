const MAX_ANIMATION_DELTA_SECONDS = 0.1;

export function sanitizeAnimationDelta(deltaSeconds: number) {
	if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
		return 0;
	}

	return Math.min(deltaSeconds, MAX_ANIMATION_DELTA_SECONDS);
}

export function sanitizeAudioEnergy(energy: number) {
	if (!Number.isFinite(energy)) {
		return 0;
	}

	return Math.min(Math.max(energy, 0), 1);
}
