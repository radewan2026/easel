import { useCallback } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useEffect, useState } from 'react';

interface ParticlesBgProps {
  color?: string;
  particleCount?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
}

export default function ParticlesBg({
  color = '#f69900',
  particleCount = 40,
  minSize = 2,
  maxSize = 6,
  speed = 0.8,
}: ParticlesBgProps) {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = useCallback(async () => {
    // particles loaded
  }, []);

  return (
    <>
      {init && (
        <Particles
          id="tsparticles"
          className="absolute inset-0 w-full h-full"
          particlesLoaded={particlesLoaded}
          options={{
            fpsLimit: 60,
            particles: {
              number: {
                value: particleCount,
                density: {
                  enable: true,
                  width: 800,
                  height: 800,
                },
              },
              color: {
                value: [color, '#fbbf24', '#f59e0b', '#d97706'],
              },
              shape: {
                type: ['circle', 'triangle'],
              },
              opacity: {
                value: { min: 0.1, max: 0.4 },
                animation: {
                  enable: true,
                  speed: 0.5,
                  sync: false,
                },
              },
              size: {
                value: { min: minSize, max: maxSize },
                animation: {
                  enable: true,
                  speed: 2,
                  sync: false,
                },
              },
              move: {
                enable: true,
                speed,
                direction: 'top',
                random: true,
                straight: false,
                outModes: {
                  default: 'out',
                },
                drift: {
                  min: -0.5,
                  max: 0.5,
                },
              },
              rotate: {
                value: { min: 0, max: 360 },
                animation: {
                  enable: true,
                  speed: 0.5,
                  sync: false,
                },
              },
            },
            interactivity: {
              detectsOn: 'canvas',
              events: {
                onHover: {
                  enable: false,
                },
                onClick: {
                  enable: false,
                },
              },
            },
            smooth: true,
            fullScreen: {
              enable: false,
            },
            background: {
              color: 'transparent',
            },
          }}
        />
      )}
    </>
  );
}
