export default function AnimatedHero({ eyebrow, title, subtitle, children }) {
  return (
    <section className="hero-gradient">
      <span className="hero-gradient-blob hero-gradient-blob-1" aria-hidden="true" />
      <span className="hero-gradient-blob hero-gradient-blob-2" aria-hidden="true" />
      <span className="hero-gradient-blob hero-gradient-blob-3" aria-hidden="true" />

      <div className="container hero-gradient-content">
        {eyebrow && <span className="eyebrow hero-gradient-eyebrow">{eyebrow}</span>}
        <h1 className="hero-gradient-title">{title}</h1>
        {subtitle && <p className="hero-gradient-subtitle">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
