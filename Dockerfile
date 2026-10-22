# Bloom — production image for any long-running container host
# (Railway, Fly.io, Render, a school VM …).
#
# On start it applies pending migrations, loads the fictional demo data if it
# isn't there yet (skipped when BLOOM_SEED_DEMO=false), then serves on $PORT.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts \
 && npm install --no-save --ignore-scripts tsx@4

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 BLOOM_UPLOAD_DIR=/data/uploads
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/supabase ./supabase
COPY --from=build /app/tsconfig.json ./
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx tsx scripts/db.ts migrate && if [ \"${BLOOM_SEED_DEMO:-true}\" != \"false\" ]; then npx tsx scripts/db.ts seed; fi && exec npx next start -p ${PORT}"]
