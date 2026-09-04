import { useEffect } from 'react';

interface SEOConfig {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: string;
  ogType?: string;
}

const SITE_URL = 'https://bowtaifitness.com';

const DEFAULT_SEO: SEOConfig = {
  title: 'Bowtai Fitness | Personal Training & Coaching Platform',
  description: 'Get personalized fitness coaching with custom workout programs, performance tracking, and expert guidance. Start your fitness journey today!',
  canonicalPath: '/',
  ogType: 'website',
};

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSEO(config: SEOConfig) {
  useEffect(() => {
    const seo = { ...DEFAULT_SEO, ...config };

    document.title = seo.title;
    setMeta('name', 'description', seo.description);
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:type', seo.ogType || 'website');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('twitter:description', seo.description);

    if (seo.canonicalPath) {
      setCanonical(`${SITE_URL}${seo.canonicalPath}`);
      setMeta('property', 'og:url', `${SITE_URL}${seo.canonicalPath}`);
    }

    if (seo.robots) {
      setMeta('name', 'robots', seo.robots);
    } else {
      const robotsEl = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (robotsEl) robotsEl.remove();
    }

    return () => {
      const d = DEFAULT_SEO;
      document.title = d.title;
      setMeta('name', 'description', d.description);
      setMeta('property', 'og:title', d.title);
      setMeta('property', 'og:description', d.description);
      setMeta('property', 'og:type', d.ogType || 'website');
      setMeta('name', 'twitter:title', d.title);
      setMeta('name', 'twitter:description', d.description);
      setCanonical(`${SITE_URL}/`);
      setMeta('property', 'og:url', `${SITE_URL}/`);
      const robotsEl = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (robotsEl) robotsEl.remove();
    };
  }, [config.title, config.description, config.canonicalPath, config.robots, config.ogType]);
}
