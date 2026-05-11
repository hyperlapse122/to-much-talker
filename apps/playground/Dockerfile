FROM node:24-slim AS builder

WORKDIR /workspace

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY apps/playground/package.json apps/playground/
COPY packages/shared/package.json packages/shared/
COPY packages/i18n/package.json packages/i18n/

RUN yarn install --immutable

COPY tsconfig.base.json ./
COPY apps/playground apps/playground/
COPY packages/shared packages/shared/
COPY packages/i18n packages/i18n/

RUN yarn workspace @to-much-talker/shared build
RUN yarn workspace @to-much-talker/i18n build
RUN yarn workspace @to-much-talker/playground build

FROM node:24-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd -r tmt && useradd -r -g tmt -s /sbin/nologin -d /app tmt

# Install serve for static file serving
RUN npm install -g serve

COPY --from=builder /workspace/apps/playground/dist /app/dist

RUN chown -R tmt:tmt /app
USER tmt

EXPOSE 3001

CMD ["serve", "-s", "dist", "-l", "3001"]
