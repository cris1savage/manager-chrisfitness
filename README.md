# Chris Fitness · Panel de Control

App real (Next.js + Supabase) con login seguro, datos guardados en base de
datos, y acceso desde cualquier ordenador para ti y tu socia. Mismo stack que
ya usas en `chrisfitness.online/comunidad`, así que el flujo de despliegue te
sonará.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **New project** (elige región Europa).
2. Cuando esté listo, entra en **SQL Editor** → **New query**.
3. Pega todo el contenido de `supabase/schema.sql` y dale a **Run**.
   Esto crea las tablas, la seguridad por fila (RLS) y el disparador que
   crea automáticamente un perfil cuando invitas a alguien.
4. Ve a **Authentication → Providers** y asegúrate de que **Email** esté
   activado. En **Authentication → Settings**, desactiva "Allow new users to
   sign up" — así nadie puede crearse una cuenta salvo que tú la invites.

4. Ve a **Authentication → Settings** y comprueba que **Multi-Factor
   Authentication (TOTP)** esté activado (suele venir activado por defecto).
   Esto es lo que permite el paso 2 de "Seguridad" dentro de la app.

## 2. Crear las dos cuentas (tú y tu socia)

1. **Authentication → Users → Add user → Create new user**.
2. Crea tu cuenta con tu email y una contraseña segura.
3. Repite para tu socia, con su propio email y contraseña.
4. (Opcional) En **Authentication → Users**, edita cada usuario y en
   `raw_user_meta_data` añade algo así para que el nombre y el rol salgan
   bien en el panel desde el primer login:
   ```json
   { "display_name": "Chris", "role_title": "Entrenador" }
   ```
   Si no lo haces, el panel usará la parte del email antes de la @ y podrás
   cambiarlo luego desde la tabla `profiles` en Supabase.

Cada una entra con su propio email/contraseña, gestionado por Supabase
(cifrado real, no texto plano), y la sesión funciona desde cualquier
navegador u ordenador.

## 3. Conectar las claves

1. En Supabase: **Project Settings → API**.
2. Copia **Project URL** y **anon public key**.
3. Copia `.env.local.example` como `.env.local` y rellena:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## 4. Probar en local (opcional)

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te llevará a `/login`.

## 5. Desplegar en Vercel

1. Sube esta carpeta a un repo de GitHub.
2. En Vercel: **New Project** → importa el repo.
3. En **Environment Variables**, añade las mismas dos variables del paso 3.
4. Deploy. Cuando termine, tendrás tu URL (puedes ponerle un dominio propio,
   por ejemplo `panel.chrisfitness.online`, desde **Vercel → Domains**).

## Novedades de esta versión

- **Registro de actividad**: cada alta, edición o borrado en Leads, Ventas,
  Anuncios, Calendario, etc. queda anotado solo (vía triggers en la base de
  datos, así no depende de que ninguna pantalla "se acuerde" de registrarlo).
  Se ve en un feed en el propio Dashboard.
- **ROI y coste por lead/venta**: calculado solo cada mes a partir de tu
  inversión en anuncios y tus ventas — coste por lead, coste por venta, y
  ROI de anuncios en %.
- **Resumen semanal en pantalla**: comparación de los últimos 7 días contra
  los 7 anteriores (leads, conversaciones, videollamadas, ventas, ingresos,
  inversión en ads), sin envíos por email.
- **Instalable como app (PWA)**: desde el móvil, "Añadir a pantalla de
  inicio" (Safari/Chrome) y os queda un icono como una app normal, a
  pantalla completa.
- **Verificación en dos pasos, opcional**: cada cuenta puede activar la suya
  desde `/seguridad` (código de una app autenticadora tipo Google
  Authenticator o Authy). No es obligatoria ni afecta a la otra cuenta —
  cada uno decide si la quiere.

## Instalar como app en el móvil

1. Abre la web desplegada desde Safari (iPhone) o Chrome (Android).
2. Safari: botón compartir → "Añadir a pantalla de inicio".
   Chrome: menú (⋮) → "Instalar app" o "Añadir a pantalla de inicio".
3. Os queda un icono de "Chris Fitness" que abre el panel a pantalla
   completa, sin barra de navegador.

## Cómo está organizado

- `app/(app)/` — todas las páginas protegidas (dashboard, calendario, leads,
  ventas, etc.). Si no hay sesión, `middleware.js` redirige a `/login`.
- `lib/config.js` — aquí están definidas las columnas de cada sección
  (Leads, Ventas, Anuncios...). Si algún día quieres añadir un campo nuevo a
  una tabla, se hace aquí + una columna nueva en Supabase.
- `components/CrmSection.jsx` — la tabla genérica que usan Leads,
  Conversaciones, Invitaciones, Videollamadas, Ventas, Anuncios y Referidos.
  Cada fila muestra un badge con las iniciales de quién la creó (tú o tu
  socia), y todo se sincroniza en tiempo real entre las dos cuentas.
- `supabase/schema.sql` — estructura completa de la base de datos.

## Seguridad

- Las contraseñas las gestiona Supabase Auth (hash seguro, no texto plano).
- No hay registro público: solo entra quien tú invites desde Supabase.
- Row Level Security está activado en todas las tablas: solo cuentas
  autenticadas (las dos vuestras) pueden leer o escribir datos.
- Aun así, esto es una app de dos usuarios de confianza, no un sistema
  bancario — no guardéis contraseñas de otras webs en "Datos importantes".

## Añadir más gente en el futuro

Si algún día quieres dar acceso a alguien más (por ejemplo un ayudante),
solo tienes que invitarlo desde **Authentication → Users** en Supabase; el
perfil se crea solo.
