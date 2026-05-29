import { useRef, useEffect, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  targetOpacity: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'square' | 'triangle';
  color: string;
  wobbleOffset: number;
  wobbleSpeed: number;
}

interface AntiGravityProps {
  particleCount?: number;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
  speed?: number;
}

export default function AntiGravity({
  particleCount = 50,
  colors = ['#f69900', '#fbbf24', '#f59e0b', '#d97706', '#92400e'],
  minSize = 4,
  maxSize = 20,
  speed = 1,
}: AntiGravityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const createParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    const shapes: Particle['shape'][] = ['circle', 'square', 'triangle'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: minSize + Math.random() * (maxSize - minSize),
        speedY: -(0.15 + Math.random() * 0.35) * speed,
        speedX: (Math.random() - 0.5) * 0.3 * speed,
        opacity: 0,
        targetOpacity: 0.15 + Math.random() * 0.35,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.8,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        wobbleOffset: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.005 + Math.random() * 0.01,
      });
    }

    return particles;
  }, [particleCount, colors, minSize, maxSize, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = createParticles(width, height);

    const drawParticle = (particle: Particle) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate((particle.rotation * Math.PI) / 180);
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;

      switch (particle.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -particle.size / 2);
          ctx.lineTo(particle.size / 2, particle.size / 2);
          ctx.lineTo(-particle.size / 2, particle.size / 2);
          ctx.closePath();
          ctx.fill();
          break;
      }

      ctx.restore();
    };

    const updateParticle = (particle: Particle, time: number) => {
      particle.opacity += (particle.targetOpacity - particle.opacity) * 0.02;

      const wobble = Math.sin(time * particle.wobbleSpeed + particle.wobbleOffset) * 0.5;

      particle.y += particle.speedY;
      particle.x += particle.speedX + wobble;
      particle.rotation += particle.rotationSpeed;

      if (particle.y < -particle.size * 2) {
        particle.y = height + particle.size * 2;
        particle.x = Math.random() * width;
        particle.opacity = 0;
      }

      if (particle.x < -particle.size * 2) {
        particle.x = width + particle.size * 2;
      } else if (particle.x > width + particle.size * 2) {
        particle.x = -particle.size * 2;
      }
    };

    const animate = (time: number) => {
      timeRef.current = time;
      ctx.clearRect(0, 0, width, height);

      for (const particle of particlesRef.current) {
        updateParticle(particle, time);
        drawParticle(particle);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [createParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
