"use client";

/**
 * Toca um bipe de notificação usando Web Audio API — sem depender de um
 * arquivo de áudio externo. Precisa ser chamado a partir de uma interação
 * do usuário anterior (ex: clique em qualquer lugar da página) para que o
 * navegador libere o áudio automático; por isso o dashboard "desbloqueia"
 * o AudioContext no primeiro clique.
 */
let audioContext: AudioContext | null = null;

export function unlockAudio(): void {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

export function playNewOrderSound(): void {
  try {
    if (!audioContext) audioContext = new AudioContext();
    const ctx = audioContext;
    const now = ctx.currentTime;

    [0, 0.18].forEach((delay, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(i === 0 ? 880 : 1046.5, now + delay);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.35, now + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + delay + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.2);
    });
  } catch {
    // Ambiente sem suporte a Web Audio API — falha silenciosamente.
  }
}
