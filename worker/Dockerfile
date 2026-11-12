# Service de lecture des sites. Contexte de construction : le dossier worker/
# (dist/server.mjs est produit avant par « pnpm worker:build »).
# La version de l'image doit rester identique à celle de playwright-core.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY dist/server.mjs ./server.mjs

RUN mkdir -p /data && chown pwuser:pwuser /data
USER pwuser

ENV PORT=8090 HOST=0.0.0.0 DATA_DIR=/data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
