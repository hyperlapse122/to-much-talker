FROM node:24-slim AS builder

WORKDIR /workspace

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY apps/docs/package.json apps/docs/
COPY packages/shared/package.json packages/shared/
COPY packages/i18n/package.json packages/i18n/

RUN yarn install --immutable

COPY tsconfig.base.json ./
COPY apps/docs apps/docs/
COPY packages/shared packages/shared/
COPY packages/i18n packages/i18n/

RUN yarn workspace @to-much-talker/shared build 2>/dev/null || true
RUN yarn workspace @to-much-talker/i18n build 2>/dev/null || true
RUN yarn workspace @to-much-talker/docs build

FROM node:24-slim AS production

WORKDIR /app

RUN groupadd -r tmt && useradd -r -g tmt -s /sbin/nologin -d /app tmt

RUN npm install -g serve

COPY --from=builder /workspace/apps/docs/dist /app/dist

RUN chown -R tmt:tmt /app
USER tmt

EXPOSE 3002

CMD ["serve", "-s", "dist", "-l", "3002"]
