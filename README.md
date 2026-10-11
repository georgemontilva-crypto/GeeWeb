# GeeWeb — tienda de ropa

Tienda en línea con panel de administración. Un solo servicio de Node sirve la tienda, el panel y la API.

- **Tienda:** portada con efectos de scroll, catálogo con categorías y búsqueda, ficha de producto con colores y tallas, bolsa, checkout, seguimiento de pedido y subpáginas editables.
- **Panel (`/admin`):** pedidos, productos, categorías, destacados, clientes, envíos, pagos, cupones, páginas, portada y ajustes.

## Stack

React 19 + Vite + Tailwind 4 · Express + tRPC · Drizzle ORM + MySQL · Cloudflare R2 (imágenes) · Resend (correos)

```
client/     Tienda y panel (React)
server/     API, subida de imágenes, correos, arranque
shared/     Tipos y utilidades compartidas
drizzle/    Esquema y migraciones de la base de datos
```

## Desplegar en Railway

1. **New Project → Deploy from GitHub repo** y elige este repositorio.
2. En el mismo proyecto: **New → Database → MySQL**.
3. En el servicio de la web, pestaña **Variables**, agrega:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
   | `JWT_SECRET` | una cadena larga y aleatoria (32 caracteres o más) |
   | `ADMIN_EMAIL` | el correo con el que vas a entrar al panel |
   | `ADMIN_PASSWORD` | la contraseña inicial del panel |

4. **Settings → Networking → Generate Domain** para obtener la dirección pública.
5. Entra a `https://tu-dominio/admin` con el correo y la contraseña del paso 3.

Railway detecta los comandos solo (`npm run build` y `npm start`). En cada arranque el servidor aplica las migraciones pendientes; la primera vez crea el usuario administrador y un catálogo de ejemplo.

### Variables opcionales

| Variable | Para qué |
| --- | --- |
| `PUBLIC_URL` | Dirección pública del sitio (enlaces de los correos). En Railway se detecta sola. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Guardar las imágenes en Cloudflare R2. Sin ellas se guardan en la base de datos: funciona, pero R2 es lo recomendado para producción. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Enviar los correos de pedido. Sin ellas no se envían correos. |
| `SEED_DEMO` | Pon `false` **antes del primer arranque** para empezar sin productos de ejemplo. |

`ADMIN_EMAIL` y `ADMIN_PASSWORD` solo se usan cuando todavía no existe ningún usuario. Después, la contraseña se cambia desde **Ajustes → Tu cuenta**.

## Desarrollo local

Necesitas Node 20 o superior y un MySQL local.

```
npm install
copy .env.example .env      (en macOS/Linux: cp .env.example .env)
npm run dev
```

La tienda queda en `http://localhost:3000` y el panel en `http://localhost:3000/admin`.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga |
| `npm run check` | Revisa los tipos con TypeScript |
| `npm run build` | Compila la tienda y el servidor en `dist/` |
| `npm start` | Arranca la versión compilada |
| `npm run db:generate` | Genera una migración después de cambiar `drizzle/schema.ts` |

## Cómo funciona

- **Precios:** se guardan en centavos. La moneda se elige en **Ajustes**; cambiarla no convierte valores.
- **Inventario:** cada combinación de color y talla tiene sus propias unidades. Se descuentan al crear el pedido y se devuelven si el pedido se cancela.
- **Pagos:** son manuales. El cliente ve los datos de pago al terminar, sube su comprobante desde la página del pedido y tú confirmas el pago en el panel.
- **Subpáginas:** se crean en **Páginas** con bloques (texto, imagen, imagen con texto, preguntas frecuentes, llamado con botón). Cada una tiene su dirección (`/nosotros`, `/envios-y-cambios`…) y puede mostrarse en el menú o en el pie.
- **Logo:** mientras no subas uno en **Ajustes → Marca**, se muestra el nombre de la tienda.
- **Fotos de producto:** se ven mejor en proporción 4:5 con fondo claro o transparente. Asigna cada foto a su color para que cambie al elegirlo.
- **Imágenes de ejemplo:** están en `client/public/demo`. Puedes borrar esa carpeta cuando ya no uses los productos de muestra.
