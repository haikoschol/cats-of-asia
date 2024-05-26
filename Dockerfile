FROM python:3.12-slim as env

ENV PYTHONUNBUFFERED=1 \
    POETRY_HOME=/opt/poetry \
    POETRY_VERSION=1.7.1 \
    # venv will be in $APP_HOME/.venv
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    APP_HOME=/app \
    DEBIAN_FRONTEND=noninteractive \
    # gets overwritten by Railway
    PORT=8080

RUN apt update && apt install -y binutils libproj-dev gdal-bin && rm -rf /var/lib/apt/lists/*

FROM env as builder

RUN python3 -m venv $POETRY_HOME
RUN $POETRY_HOME/bin/pip install poetry==$POETRY_VERSION

WORKDIR $APP_HOME

COPY pyproject.toml poetry.lock manage.py ./
COPY catsofasia ./catsofasia
COPY photos ./photos
COPY templates ./templates
RUN $POETRY_HOME/bin/poetry run pip install gunicorn==21.2.0
RUN $POETRY_HOME/bin/poetry install --no-root --without=dev

from env as production

LABEL org.opencontainers.image.source=https://github.com/haikoschol/cats-of-asia

COPY --from=builder $APP_HOME $APP_HOME

WORKDIR $APP_HOME
EXPOSE $PORT
CMD exec ./.venv/bin/gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 catsofasia.wsgi:application
