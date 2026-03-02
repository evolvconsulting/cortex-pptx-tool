# HTML2PPTX Service for Snowpark Container Services

FROM node:18-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:18-slim
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    libreoffice-impress \
    poppler-utils \
    fonts-liberation2 \
    fonts-dejavu-core \
    fontconfig \
    ca-certificates \
    wget \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man /tmp/* /var/tmp/*

RUN mkdir -p /usr/share/fonts/truetype/montserrat && \
    wget -q "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf" \
         -O /usr/share/fonts/truetype/montserrat/Montserrat-Regular.ttf && \
    wget -q "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf" \
         -O /usr/share/fonts/truetype/montserrat/Montserrat-Bold.ttf && \
    wget -q "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-SemiBold.ttf" \
         -O /usr/share/fonts/truetype/montserrat/Montserrat-SemiBold.ttf && \
    fc-cache -f && rm -rf /var/cache/fontconfig/*

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

RUN npx playwright install chromium && rm -rf /root/.cache

COPY src/ ./src/

RUN mkdir -p /tmp/html2pptx && chmod 777 /tmp/html2pptx

RUN chown -R node:node /app /ms-playwright
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]
