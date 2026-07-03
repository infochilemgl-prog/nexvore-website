# Empanadas Katty — Limache

Landing page real para Empanadas Katty (Limache). Vite + React + TypeScript + Tailwind CSS. Sin backend: reservas y cotizaciones arman un link de WhatsApp con los datos ingresados.

## Desarrollo

```
npm install
npm run dev
```

## Build de producción

```
npm run build
```

Genera `dist/`, listo para Cloudflare Pages o GitHub Pages (sitio estático).

## Pendientes antes de publicar

- **Número de WhatsApp**: actualmente usa el placeholder `56912345678` en `src/lib/whatsapp.ts`. Reemplazar por el número real del local.
- **Fotos reales**: faltan todas las fotos listadas en `public/fotos/README.md`. Mientras no existan, cada sección muestra un placeholder honesto (borde punteado) en vez de romper el layout o usar una imagen genérica.
- **Reseñas de Google**: las 3 tarjetas de reseña son placeholders — pegar 3 reseñas reales copiadas de Google cuando el cliente las comparta.
- **Dirección y horario**: no confirmados en el brief — quedaron como texto pendiente en la sección "Cómo llegar" y en el footer.
- **QR de mesa**: el código QR se debe generar una vez que el sitio tenga su dominio final de publicación.
