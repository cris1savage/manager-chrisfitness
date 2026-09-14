# CF Clientes — Panel de seguimiento físico

Panel privado de seguimiento de clientes de Chris Fitness.
Acceso solo para el entrenador. Los clientes no tienen cuenta.

---

## Qué contiene

- **Lista de clientes activos** con peso actual, fase y tendencia
- **Resumen** — cards de peso, gráfica con filtros (1S/1M/3M/6M/12M), objetivos, métricas de compromiso, fases
- **Mes actual** — semanas, entrenamiento/nutrición, videollamada, mediciones corporales
- **Timeline** — tabla semanal con kcal ON/OFF, objetivo y peso real
- **Historial** — todos los meses anteriores en acordeón

---

## Paso 1 — Base de datos (Supabase)

Misma base de datos que el manager. Solo hay que ejecutar la migración:

1. Abre **Supabase → SQL Editor**
2. Copia y ejecuta el contenido de `supabase/migration.sql`

Esto añade dos columnas nuevas sin tocar nada existente.

---

## Paso 2 — Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

Son los mismos valores que tienes en el manager.
Los encuentras en **Supabase → Settings → API**.

---

## Paso 3 — Subir a GitHub

```bash
cd cf-clientes
git init
git add .
git commit -m "Initial commit — CF Clientes"
# Crea un repo nuevo en github.com y conecta:
git remote add origin https://github.com/TU_USUARIO/cf-clientes.git
git push -u origin main
```

---

## Paso 4 — Desplegar en Vercel

1. Ve a **vercel.com → Add New Project**
2. Importa el repo `cf-clientes` que acabas de crear
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Pulsa **Deploy**

---

## Paso 5 — Dominio personalizado

En Vercel, una vez desplegado:

1. Ve a **Settings → Domains**
2. Añade `clientes.chrisfitness.online`
3. En tu proveedor de dominio, añade un registro CNAME:
   - Nombre: `clientes`
   - Valor: `cname.vercel-dns.com`

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local
# Rellena las variables
npm run dev
# Abre http://localhost:3000
```
