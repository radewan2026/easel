import { useEffect, useRef, useState } from 'react';

interface AnimatedTextProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  animation?: 'slideUp' | 'fadeIn' | 'blurIn';
  stagger?: number;
  delay?: number;
  threshold?: number;
  style?: React.CSSProperties;
}

export default function AnimatedText({
  text,
  as: Tag = 'span',
  className = '',
  animation = 'slideUp',
  stagger = 60,
  delay = 0,
  threshold = 0.2,
  style,
}: AnimatedTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, threshold]);

  const words = text.split(' ');

  const animClass = {
    slideUp: 'translate-y-[120%] opacity-0',
    fadeIn: 'opacity-0',
    blurIn: 'opacity-0 blur-sm',
  }[animation];

  const animActiveClass = {
    slideUp: 'translate-y-0 opacity-100',
    fadeIn: 'opacity-100',
    blurIn: 'opacity-100 blur-0',
  }[animation];

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={className} style={style}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.3em] last:mr-0">
          <span
            className={`inline-block transition-all duration-700 ease-out ${
              isVisible ? animActiveClass : animClass
            }`}
            style={{ transitionDelay: isVisible ? `${i * stagger}ms` : '0ms' }}
          >
            {word}
          </span>
        </span>
      ))}
    </Tag>
  );
}
