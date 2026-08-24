# Guía para colaboradores — GSI (Gastronomy Search Intelligence)

Esta guía es para cualquier persona que descargue este repositorio y quiera
levantarlo localmente, entender qué hay hecho y qué falta para que la
**Fase 1 (~40% del proyecto)** quede terminada y funcionando de punta a punta.

No necesitas leer todo el código antes de empezar: sigue los pasos en orden.

---

## 1. Qué es este proyecto

GSI es una plataforma de búsqueda de restaurantes gourmet en Villavicencio,
Colombia. Esta fase **no incluye IA, NLP, recomendaciones ni web scraping** —
eso es fase 2. Esta fase es la base funcional: modelo de datos, CRUD,
búsqueda con filtros, geolocalización estática (Haversine) y la interfaz.

```
/backend    API REST — Node.js + Express + MySQL, auth JWT
/frontend   React (Vite) — sin frameworks de UI, CSS plano con variables
```

---

## 2. Requisitos antes de empezar

Instala esto si no lo tienes:

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| Node.js | 18+ | `node -v` |
| MySQL   | 8+  | `mysql --version` |
| Git     | cualquiera | `git --version` |

MySQL debe estar **corriendo** (como servicio local o en Docker) antes del
paso 4.

---

## 3. Clonar y ubicarse

```bash
git clone https://github.com/Fredpuff/Proyecto-de-grado-Gastroapp.git
cd Proyecto-de-grado-Gastroapp
```

---

## 4. Levantar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Abre `backend/.env` y pon tu contraseña real de MySQL:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_real
DB_NAME=gsi_db
JWT_SECRET=cualquier_texto_largo_y_aleatorio
```

Crea la base de datos y cárgala con datos de ejemplo (9 restaurantes,
menús, parqueaderos, usuarios y reseñas):

```bash
npm run seed
```

Si ves `Aplicando schema.sql...` → `Aplicando seed.sql...` → `Listo:...`,
funcionó. Si da error de acceso denegado, revisa `DB_USER`/`DB_PASSWORD`
en el `.env`.

Levanta el servidor:

```bash
npm run dev
```

Verifica en el navegador o con `curl`: `http://localhost:4000/api/health`
debe responder `{"status":"ok","service":"gsi-backend"}`.

### Usuarios de prueba (creados por el seed)

| Rol | Email | Password |
|---|---|---|
| admin | admin1@gsi.test | Admin123! |
| admin | admin2@gsi.test | Admin123! |
| admin | admin3@gsi.test | Admin123! |
| cliente | cliente1@gsi.test | Cliente123! |
| cliente | cliente2@gsi.test | Cliente123! |

---

## 5. Levantar el frontend

En otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. Deberías ver la página de inicio con 9
restaurantes cargados, filtros funcionando y el hero con la paleta cálida
(terracota / crema / verde oliva).

---

## 6. Checklist para probar que todo funciona

Marca cada uno mientras lo pruebas manualmente en el navegador:

- [ ] La página de inicio carga y muestra las 9 tarjetas de restaurantes.
- [ ] Los filtros (cocina, zona, precio, wifi, parqueadero) reducen los
      resultados correctamente y se pueden combinar.
- [ ] Al hacer clic en una tarjeta se abre la ficha con menú, horario y mapa.
- [ ] El mapa (Leaflet) muestra el restaurante y sus parqueaderos cercanos.
- [ ] Registrarse como **cliente** funciona y deja loguear después.
- [ ] Logueado como cliente, se puede dejar una reseña y aparece en la lista.
- [ ] Registrarse como **admin** (o usar `admin1@gsi.test` / `Admin123!`)
      lleva al panel `/admin` con sus restaurantes.
- [ ] Desde el panel se puede **crear** un restaurante nuevo.
- [ ] Desde "Editar" se puede **modificar** un restaurante existente.
- [ ] Desde la edición se puede **agregar/editar/borrar** platos del menú.
- [ ] **Eliminar** un restaurante funciona y desaparece de la búsqueda.
- [ ] Un admin **no puede** editar/borrar restaurantes de otro admin
      (prueba con dos cuentas admin distintas — debe dar 403).

Si algo de esta lista falla, ese es el primer punto a arreglar antes de
seguir con nada nuevo.

---

## 7. Qué falta para que el 40% quede excelente

Esto es lo que **no alcancé a verificar o pulir** y queda como tarea para
quien continúe:

### Prioridad alta — bloquea la calidad del entregable
1. **Correr el checklist de la sección 6 completo con datos reales.**
   El backend y frontend se probaron por separado (build, sintaxis, estados
   de error), pero el flujo de punta a punta con una base de datos real
   nunca se ejecutó de principio a fin. Es el paso más importante.
2. **Revisar el diseño responsive en un celular real o en las DevTools**
   (F12 → modo responsive). El CSS ya tiene media queries (820px y 640px)
   pero no se confirmó visualmente en pantallas angostas.
3. **Probar los mensajes de error de los formularios** (registro, login,
   crear restaurante, agregar plato) con datos inválidos: email duplicado,
   contraseña corta, precio negativo, campos vacíos. El backend valida,
   pero conviene confirmar que el mensaje que ve el usuario es claro.

### Prioridad media — mejora la robustez
4. **Tests automatizados.** Hoy no hay ningún test (unitario ni de
   integración). Para un proyecto de grado, aunque sea un puñado de tests
   con Jest/Vitest en los endpoints críticos (login, búsqueda con filtros,
   Haversine) suma mucho a la nota de calidad.
5. **Manejo de sesión expirada.** Si el JWT expira mientras el usuario
   navega, el frontend no muestra ningún aviso — simplemente empiezan a
   fallar las peticiones. Vale la pena detectar el 401 y redirigir a
   `/login` con un mensaje.
6. **Confirmaciones de borrado.** Hoy usan `window.confirm()` nativo del
   navegador (funcional pero feo). Se puede cambiar por un modal propio
   si se quiere pulir la UI.

### Prioridad baja — pulido opcional
7. **Subida real de imágenes.** Ahora mismo `image_url` es un campo de
   texto (pega un link) y si está vacío se muestra un placeholder con las
   iniciales del restaurante — así se pidió para esta fase, pero si se
   quiere ir más allá, se podría integrar una subida de archivo real.
8. **Gestión de parqueaderos desde el panel admin.** El backend ya tiene
   CRUD completo de parqueaderos (`/api/parkings`), pero no hay pantalla
   en el frontend para gestionarlos — solo se cargan por seed. No estaba
   pedido explícitamente para esta fase, pero es fácil de agregar
   reutilizando el patrón de `AdminMenuManager.jsx`.
9. **Paginación de resultados de búsqueda.** Con 9 restaurantes no hace
   falta, pero si el catálogo crece, `GET /api/restaurants` debería
   soportar `limit`/`offset`.

### Fuera de alcance (fase 2, no tocar todavía)
IA / NLP, análisis de sentimiento de reseñas, recomendaciones
personalizadas, web scraping real, integraciones de pago. Están fuera de
esta fase a propósito, según el alcance original del proyecto.

---

## 8. Estructura del código (para orientarse rápido)

```
backend/
  sql/schema.sql          → todas las tablas y relaciones
  sql/seed.sql             → datos de ejemplo
  src/controllers/         → lógica de cada recurso (restaurantes, menú, parqueaderos, reseñas, auth)
  src/routes/               → qué URL llama a qué controlador
  src/middleware/auth.js    → verificación de JWT y roles
  src/utils/haversine.js    → cálculo de distancia entre coordenadas

frontend/
  src/pages/                 → una página por ruta (Home, Login, Admin, etc.)
  src/components/            → piezas reutilizables (tarjetas, mapa, formularios)
  src/api/resources.js       → todas las llamadas al backend, centralizadas aquí
  src/context/AuthContext.jsx → sesión del usuario (token, login/logout)
  src/constants.js           → listas fijas (zonas, rangos de precio, tipos de parqueadero)
```

Si vas a agregar un endpoint nuevo: créalo en `backend/src/controllers/` →
regístralo en `backend/src/routes/` → consúmelo desde
`frontend/src/api/resources.js` → úsalo en la página o componente que lo
necesite. Ese es el patrón que sigue todo el proyecto.

---

## 9. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Error: listen EADDRINUSE :::4000` | Ya hay un backend corriendo en ese puerto | Cierra la otra terminal o cambia `PORT` en `.env` |
| `Access denied for user 'root'@'localhost'` al correr `npm run seed` | Contraseña de MySQL incorrecta en `.env` | Revisa `DB_PASSWORD` |
| El frontend muestra "Error interno del servidor" en todas las páginas | El backend no está corriendo o la BD no existe | Corre `npm run dev` en `/backend` y confirma que hiciste `npm run seed` antes |
| Filtros no traen resultados nuevos | El backend no aplicó el seed, la tabla está vacía | Corre `npm run seed` de nuevo (borra y recarga los datos) |
| `403 No tienes permisos sobre este restaurante` | Estás logueado con un admin que no es dueño de esa ficha | Usa el admin correcto o crea tu propio restaurante primero |

---

Cualquier duda sobre por qué algo se decidió así (por ejemplo, por qué
`rating_avg` se carga a mano y no se calcula), está explicado en los
comentarios de scope del `README.md` raíz.
