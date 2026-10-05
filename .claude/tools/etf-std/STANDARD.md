# Стандарт ETF-репозиториев

Один документ для людей и субагентов. Описывает, как должен выглядеть каждый из 29 репозиториев в папке `ETFs`, чем это проверяется и как привести репозиторий к стандарту. Здесь только текущее состояние, истории раундов нет.

Короткие версии правил лежат в `ETFs/.claude/rules/etf-*.md` (их подгружает Claude Code). Этот файл подробнее и содержит эталонный код.

## 0. Как пользоваться (для субагента)

- Прочитайте файл целиком и работайте только в одном указанном репозитории
- Работайте в ветке от свежего `origin/main`, откройте один PR, сами его не мержите (мержит контроллер скриптом `verify_merge.sh`)
- Перед началом проверьте `git status`: чужие незакоммиченные изменения не трогать (`.idea/` и `node_modules/` принадлежат владельцу)
- В конце сообщите по-русски коротко: ссылка на PR, что изменено, результаты проверок, что не удалось

## 1. Жёсткие правила

- Только Bun, без зависимостей: в `package.json` нет `dependencies`, только `@types/bun` и `@types/node` в `devDependencies`. Не добавлять `tsconfig.json` и `typescript`
- Строка `/// <reference types="bun" />` (у iShares `node`) в `scripts/update-data.ts` остаётся на месте, после shebang
- Токены, пароли и личные адреса в файлы и логи не попадают. Исключение по решению владельца: SEC-контакт `daggerok@gmail.com` (см. раздел 3)
- Данные из `api/` в коммиты не попадают: после любого живого прогона `git checkout -- api/` и удаление созданных файлов
- Коммиты по Conventional Commits (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert), описание короткое, строчными, без точки
- Проза в файлах: обычный дефис вместо тире, `->` вместо стрелки, без точки в конце пунктов списка

## 2. Раскладка репозитория

В корне остаются: `api/` (данные), `scripts/`, `.github/`, `src/` (`index.html`, `main.tsx`, `index.css`, `favicon.ico`), `package.json`, `bun.lock`, `README.md`, `LICENSE`, `.gitignore`. Папки `data/` нет ни в одном репозитории (check-scripts.ts её не пропускает): статические таблицы лежат внутри `scripts/update-data.ts`, JSON-состояние, которое updater пишет сам, лежит в `api/<feed>/` (Fidelity: `held-tickers.json`, `held-ticker-misses.json`), образцы для тестов маленькие и лежат внутри теста.

`scripts/` содержит ровно три файла:

| Файл | Назначение |
|---|---|
| `update-data.ts` | updater, запускается напрямую `./scripts/update-data.ts` |
| `update-data.config.json` | значения по умолчанию для всех контролов, значения строками |
| `update-data.test.ts` | единственный тест-файл |

Запрещено и удаляется везде: `.worklog.txt`, `.prompt.txt`, `evidence/`, `research/`, `.plans/`, `COMPLETION.md`, `scripts/fixtures/`, любые вспомогательные скрипты и тесты UI.

`.github/` содержит только `workflows/update-data.yml`, `workflows/github-pages.yml` и `dependabot.yml`. Никаких workflow для CI и проб. В корне нет `app.tsx` и `index.html`: приложение собирает Parcel из `src/` (`bun run build`, `bun run serve`, `bun run build-github-pages`), `dist/` в git не попадает. Имя в `workflow_run.workflows` у `github-pages.yml` равно `name:` у `update-data.yml` (проверяет `etf-std/check-pages.ts`).

`package.json`: `"scripts"` с `test` (`bun test`), `update` (`bun scripts/update-data.ts`) и сборкой Parcel (`clean`, `build`, `serve`, `build-github-pages` с `--public-url=/<Repo>/`), без флагов Bun; сборочные пакеты (parcel, tailwindcss, @tailwindcss/postcss, ncp, rimraf) в `devDependencies`, `dependencies` пуст.

`scripts/update-data.ts` начинается с `#!/usr/bin/env bun` и имеет git-режим 100755 (`git update-index --chmod=+x scripts/update-data.ts`).

Dependabot одинаков везде (эталон `tools/dependabot.ref`): bun и github-actions, каталог `/`, раз в месяц, лимит PR 10.

## 3. Настройки updater (контролы)

Источник значений по умолчанию - `scripts/update-data.config.json`. Локально переопределяем переменными окружения, в CI - параметрами workflow.

Порядок слоёв, один и тот же в каждом репозитории (`resolveControls(file, advanced, inputs, env)`):

1. файл `update-data.config.json`
2. JSON `advanced` из workflow
3. непустые именованные входы workflow
4. переменные окружения (явно заданная переменная побеждает, даже пустая: она сбрасывает контрол)
5. защищённые переменные репозитория GitHub (только в workflow, например `SEC_UA`)

Почему окружение авторитетно: workflow записывает итоговые значения в `GITHUB_ENV`, а updater разрешает их ещё раз. Пустой вход workflow наследует значение файла, пустое окружение - нет.

Правила валидации:
- Строгая: неверное число, булево, диапазон или `min:max` - ошибка с понятным текстом, тихой подмены значением по умолчанию нет
- Ключи только из `CONTROL_NAMES`, значения строка, число или булево, символы CR, LF и NUL запрещены
- `MAX_RETRIES` - целое не меньше 1
- CLI и workflow используют один и тот же `resolveControls`
- Сохраняются старые алиасы окружения (`<БРЕНД>_<ИМЯ>`, `HISTORICAL_PAGE_SIZE`)

Набор контролов должен быть одинаков везде, где у провайдера есть данные: `MAX_FETCHES`, `REQUEST_SLEEP`, `CONCURRENCY`, `TICKERS`, фильтры `AUM`, `TER`, `DIVIDEND_YIELD`, `SEC_YIELD`, `PERFORMANCE_{YTD,1Y,3Y,5Y,10Y}`, `TOTAL_RETURN_{YTD,1Y,3Y,5Y,10Y}`, `HOLDINGS_PAGE_SIZE`, `HISTORY_PAGE_SIZE`, `MAX_RETRIES`, `HISTORY_RANGE`, `VERBOSE`, `USE_SYSTEM_CA`, плюс `SEC_UA`, `SKIP_YAHOO`, `EDGAR_FALLBACK` там, где используются SEC и Yahoo. Контрол-пустышка запрещён: либо он реально работает, либо его нет (причина указана в README). `HISTORY_RANGE` обязан реально сужать запрос к Yahoo через явные `period1` и `period2` (при `period1=0` Yahoo игнорирует `range`).

SEC-контакт: `daggerok ETF feed daggerok@gmail.com`. Это значение по умолчанию в конфиге и в коде, в логах скрыто (`<redacted>`), переменная репозитория `SEC_UA` его перекрывает. Адресов `example.com` в качестве контакта быть не должно.

Фильтрованные и ограниченные запуски (`TICKERS`, `MAX_FETCHES`, фильтры, пропуск провайдера) никогда не уменьшают опубликованную ленту: строки каталога и файлы невыбранных фондов сохраняются как были, `index.json` всегда содержит все известные фонды (`funds/*/meta.json`). Это проверяется тестом на подменённом `fetch`: запуск на одном тикере оставляет в `index.json` столько же строк, сколько было. Инцидент: ручной запуск workflow с одним тикером сократил `index.json` до 1 строки в Schwab и WisdomTree (а раньше и в Pacer, Goldman-Sachs).

## 4. Конкурентность

`CONCURRENCY=15 ./scripts/update-data.ts` должен реально качать фонды параллельно:
- пул воркеров, у каждого воркера своя линия запросов, `REQUEST_SLEEP` выдерживается на каждую линию
- один глобальный ограничитель на все запросы запрещён: он делает `CONCURRENCY` бесполезным (так было в Sprott, aberdeen, Amplify, Franklin, теперь исправлено)
- единственное исключение - прокси `r.jina.ai` (Schwab, Pacer, Goldman-Sachs, Franklin, Parametric, Themes): один глобальный ограничитель, не меньше 3.2 с между стартами, повтор прокси не чаще одного раза, потому что прокси ограничен примерно 20 запросами в минуту
- доказательство в тесте: счётчик одновременных запросов на подменённом `fetch` (пик 1 при `CONCURRENCY=1`, пик N при `CONCURRENCY=N`)

## 5. TLS и `USE_SYSTEM_CA`

Контрол `USE_SYSTEM_CA` принимает `auto` (по умолчанию), `true`, `false` (регистр не важен). При `auto` updater сам один раз перезапускается с `--use-system-ca`, если запрос упал из-за недоверенного сертификата (например, за прокси с подменой TLS). Настраивается только контролом скрипта, не `BUN_OPTIONS` и не `package.json`. В workflow отдельного входа нет (только `advanced`).

Эталонный код (копируется в `update-data.ts` без изменений, вызов `installSystemCa(controls.USE_SYSTEM_CA)` стоит в `main()` сразу после разрешения контролов и до первого запроса; `fetch` везде вызывается в момент запроса, а не кэшируется):

```ts
// --- TLS trust store (identical in every ETF repo) ---
const SYSTEM_CA_MARKER = 'ETF_UPDATER_SYSTEM_CA';
const CERT_ERROR = /UNABLE_TO_GET_ISSUER_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT|CERT_HAS_EXPIRED|unable to get (?:local )?issuer certificate|self[- ]signed certificate|certificate has expired/i;

export function isCertError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; cause?: unknown } | null;
  return CERT_ERROR.test(`${String(e?.code ?? '')} ${String(e?.message ?? '')}`) || (e?.cause ? isCertError(e.cause) : false);
}

export function systemCaActive(env: Record<string, string | undefined> = process.env, execArgv: string[] = process.execArgv): boolean {
  return execArgv.includes('--use-system-ca') || env.NODE_USE_SYSTEM_CA === '1' || env[SYSTEM_CA_MARKER] === '1';
}

export function reexecWithSystemCa(): never {
  const child = Bun.spawnSync([process.execPath, '--use-system-ca', ...process.argv.slice(1)], {
    env: { ...process.env, [SYSTEM_CA_MARKER]: '1' },
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  process.exit(child.exitCode ?? 1);
}

/** mode: auto (restart once on an untrusted-certificate error), true (restart now), false (never). */
export function installSystemCa(mode: string, reexec: () => never = reexecWithSystemCa, active: boolean = systemCaActive()): void {
  if (mode === 'false' || active) return;
  if (mode === 'true') reexec();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    try { return await realFetch(...args); }
    catch (error) {
      if (!isCertError(error)) throw error;
      console.error('[ notice   ] TLS certificate not trusted; restarting once with --use-system-ca');
      return reexec();
    }
  }) as typeof fetch;
}
```

Тесты на это: резолвер (три значения, отказ на `maybe`, дефолт `auto` из конфига), `isCertError` (код, сообщение, `cause`, не-сертификатные ошибки), `installSystemCa` (режимы `false`, активный флаг, `true`, `auto` с сертификатной и обычной ошибкой, успех). После каждого теста `globalThis.fetch` восстанавливается.

## 6. Workflow `update-data.yml`

Генерируется `etf-std/gen-workflow.ts` из JSON-спецификации, руками не правится. Если нужно то, чего генератор не умеет, расширяется генератор.

Поля спецификации: `name`, `slug` (каталог `api/<slug>`), `commitTitle`, `inputs` (отдельные входы, не больше 24), `protectedVars` (контрол -> имя переменной репозитория, например `{ "SEC_UA": "SEC_UA" }`), `requiredControls`, `extraAdd` (дополнительные пути для коммита, например `data/held-tickers.ts`).

Шаблон одинаков везде: расписание раз в неделю (`0 0 * * 0`) плюс ручной запуск, права `contents: write`, очередь `update-data` без отмены, `timeout-minutes: 30`, `actions/checkout` с `persist-credentials: false`, `bun install --frozen-lockfile`, `bun test` до обновления, шаг разрешения настроек (файл, `advanced`, входы, защищённые переменные), запуск updater, коммит только `api/<slug>` (плюс `extraAdd`) с токеном только на время `git push`. Выходная папка фиксирована и входом не бывает.

GitHub разрешает максимум 25 входов `workflow_dispatch`: 24 отдельных плюс `advanced` (JSON с остальными контролами). Все контролы без отдельного входа доступны через `advanced` и файл настроек.

Некоторые провайдеры блокируют адреса GitHub-раннеров (Themes отвечал HTTP 403): им нужен резервный путь через `r.jina.ai` и сохранение ранее опубликованных данных вместо падения. Локальный прогон этого не доказывает, поэтому проверка - ручной запуск workflow с одним тикером.

## 7. README

Порядок разделов одинаков везде: заголовок и описание, `## Using Bun`, `## Updating the static <X> data` (внутри `### Data sources`, `### Metrics and caveats`, `### Update controls`, `### Examples`), `## TypeScript and verification`, `## Brands table`, `## Sibling applications`, `## License` (MIT и оговорка о независимости от эмитента).

Таблица контролов совпадает с конфигом, `--help` и `CONTROL_NAMES` (это проверяет тест). Раздел проверки содержит ровно четыре команды: `bun install --frozen-lockfile`, `bun test`, `bun build --target=bun scripts/update-data.ts --outfile=/dev/null`, `git diff --check`.

Две таблицы брендов - один канонический блок из `registry.json`. Вручную их править нельзя: `bun etf-std/apply-shared-blocks.ts .`. Если Pages ещё не включён, в таблице стоит пометка `(deployment pending)`, она берётся из `pagesPending` реестра.

## 8. GitHub About и Pages

- Описание: `<Бренд> ETF holdings-to-watchlist: static ./api/<feed> feed generated by a Bun updater from <источники>`, не больше 350 символов
- Homepage: `https://daggerok.github.io/<Repo>/` с точным регистром имени
- Темы строго такие: `css csv etf finance github-pages holdings html json static-api typescript watchlist` (запрос `PUT repos/.../topics` заодно удаляет лишние)
- Pages: источник GitHub Actions (`build_type: workflow`), деплой делает `.github/workflows/github-pages.yml`; порядок выкатки и гонка с Jekyll описаны в `.claude/parcel-migration.md`

Генерация и проверка: `etf-std/about.ts` и `etf-std/verify-about.ts`.

## 9. Тесты (`update-data.test.ts`)

Один файл, офлайн, без сети и фикстур, данные маленькими встроенными образцами. Внутри: резолвер и приоритеты, строгая валидация, соответствие конфига, `CONTROL_NAMES`, README и `--help`, форма workflow (входов не больше 25, есть `advanced`, жёсткие настройки), структура README (29 брендов), парсеры провайдера, конвейер обновления на подменённом `fetch`, конкурентность, TLS. Не должно быть тестов на живые данные из `api/`, на UI, на закреплённые внешние файлы. Жёстко прописанные числа (например число брендов) ломаются при изменении реестра, поэтому после любого общего изменения запускайте `bun test` везде.

## 9a. Поля `metrics` в `api/<slug>/index.json` (контракт для хаба)

Каждая строка `funds[]` содержит объект `metrics`. Хаб склеивает каталоги всех брендов и сортирует по ним, поэтому имена, единицы и пустые значения одинаковы везде:

| Поле | Смысл |
|---|---|
| `ytd`, `tr1y`, `tr3y`, `tr5y`, `tr10y` | накопленная полная доходность, проценты числом (4.27 = 4.27%) |
| `cagr3y`, `cagr5y`, `cagr10y`, `siAnn` | годовая доходность, проценты числом |
| `dividendYield`, `secYield` | доходности, проценты числом |
| `dividendYieldBasis` | короткий код определения, на котором стоит `dividendYield` (`null`, когда доходность `null`); пять значений ниже. Пока ленты его не несут, хаб считает отсутствие ключа «неизвестно» и показывает прочерк |
| `returnsBasis` | ОБЯЗАТЕЛЬНАЯ непустая строка: чем рассчитаны доходности (например `official <Provider> NAV total returns`, `derived from Yahoo Finance adjusted close`, или смешанно с пояснением) |
| `performanceAsOf` | ОБЯЗАТЕЛЬНОЕ поле: дата `YYYY-MM-DD`, на которую рассчитаны доходности (дата таблицы эмитента, а для расчёта по Yahoo - последняя дата цены), либо `null`. Это не дата NAV |

Коды `dividendYieldBasis` (утверждено 2026-10-04):

| Код | Бейдж в хабе | Определение |
|---|---|---|
| `official-trailing-12m` | 12M | официальная доходность за trailing 12 месяцев, как её публикует эмитент |
| `official-distribution-rate` | DIST | официальная distribution rate эмитента (последняя выплата в пересчёте на год / NAV) |
| `official-other` | OFFC | официальная доходность эмитента с другим определением (например, 12-month yield по иной методике) |
| `computed-trailing-12m` | CALC | посчитана updater'ом: сумма выплат за 12 месяцев / цена или NAV |
| `indicated` | IND | индикативная: последняя выплата x число выплат в год / NAV |

Правила: недоступное значение - `null`, никогда `0`; `returnsBasis` не бывает пустым или `-`; `performanceAsOf` не бывает пустой строкой. Оценки (Yahoo) подписаны как оценки в `returnsBasis`.

## 9b. Устойчивость updater и честность данных

Действует в каждом репозитории, где у провайдера есть данные:

- Сеть: у каждого запроса таймаут (`AbortSignal.timeout`, по умолчанию 45 с, заголовки и тело), повторы по `MAX_RETRIES`; обработка 403 у провайдеров, которым она нужна, не меняется
- Атомарные и упорядоченные записи: JSON пишется через временный файл и `rename`. Для фонда сначала страницы, потом `meta.json`, потом строка индекса; старые страницы удаляются только после записи нового meta. Индекс пишется в конце, а прогон перестаёт брать новые фонды по мягкому дедлайну 25 минут и всё равно пишет индекс (таймаут workflow 30 минут)
- Согласованность на уровне фонда: workflow коммитит и после частичного прогона, и это допустимо только потому, что каждый фонд либо обновлён целиком, либо целиком оставлен прежним. Фонд собирается целиком в памяти и пишется один раз; если нужный источник упал, остаётся прежнее полное состояние (никогда новая полная доходность рядом со старыми остальными колонками)
- Запись только при реальном изменении: повторный прогон с теми же данными даёт НОЛЬ изменений в git. `generatedAt` и подобные метки двигаются, только если сдвинулось содержимое. Тест: два прогона на одном подменённом `fetch`, второй ничего не пишет
- Удержание прежних значений только при сбое источника или отсутствии страницы, не при честном `null`; `performanceAsOf` и `returnsBasis` едут вместе с доходностями, которые описывают
- Резервные источники (EDGAR, N-PORT) не заменяют более свежие данные и проверяют личность фонда
- Новые фонды: если в каталоге есть тикеры, которых нет в прежнем индексе, печатается `NEW FUNDS: A, B` и дописывается в `$GITHUB_STEP_SUMMARY`, когда он задан
- `dataFile`: строка без `funds/<T>/meta.json` получает `dataFile: null` и всё равно полный объект `metrics` (все ключи `null` плюс `returnsBasis`); хаб показывает для неё только вкладку Overview
- TER: `terValue` - NET (после waiver; единственное число, если другого нет), `terGrossValue` - GROSS, когда опубликован; ничего не выдумывать и не ставить заглушек. Хаб показывает net, gross в подсказке и оба в CSV

## 10. Как привести один репозиторий к стандарту

1. `git fetch`, ветка от свежего `origin/main`
2. Удалить лишнее по разделу 2, влить полезные тесты в `update-data.test.ts`
3. Привести резолвер, контролы, `MAX_RETRIES`, `SEC_UA`, `USE_SYSTEM_CA`, конкурентность (разделы 3-5)
4. Сгенерировать workflow (раздел 6)
5. Обновить README и применить общие таблицы (раздел 7)
6. Проверки (обязательны):
   - `bun install --frozen-lockfile`, `bun test`, `bun build --target=bun scripts/update-data.ts --outfile=/dev/null`, `git diff --check origin/main...HEAD`
   - `bun etf-std/check-readme.ts .`, `bun etf-std/check-workflow.ts .`, `bun etf-std/check-pages.ts .`, `bun etf-std/check-scripts.ts .`
   - строка `<reference types=` на месте, shebang и режим 100755
   - `USE_SYSTEM_CA=maybe ./scripts/update-data.ts` падает сразу с понятной ошибкой
   - по возможности изолированный живой прогон на 1-3 тикерах с `MAX_RETRIES=1`, затем `git checkout -- api/`
7. Запушить ветку и открыть PR

## 11. Слияние и проверка CI (делает контроллер)

- `verify_merge.sh <репо> <ветка>`: прогоняет все проверки на ветке и делает squash-merge только если всё зелёное
- Dependabot: `dep_merge.sh <репо>` (предварительно комментарий `@dependabot rebase`), PR про удалённые workflow закрываются
- `pkg_normalize.sh <репо>`: приводит скрипты `package.json` к стандарту
- `final_check.sh <репо>`: свежий `main`, все проверки, отсутствие лишних файлов и workflow, SEC-контакт (отсутствие контакта или адрес example.com - ошибка)
- Все `*.sh` принимают имя репозитория, отказываются работать без него и с грязным деревом, и не делают `git checkout -- .` в чужом дереве
- После слияния запустить `update-data.yml` вручную с одним тикером в каждом репозитории: это единственное доказательство, что CI-путь работает

## 12. Известные особенности

- Провайдеры за WAF идут через `r.jina.ai` с общим ограничителем: Schwab, Pacer, Goldman-Sachs, Franklin, Parametric, Themes (каталог при 403)
- Без SEC и Yahoo: iShares, SPDR, ProShares (SEC нет); у них нет `SEC_UA`, `SKIP_YAHOO`, `EDGAR_FALLBACK`
- `HISTORY_RANGE` недоступен там, где источник отдаёт историю целиком без параметра окна (iShares)
- Amplify: каталог, факты, NAV и официальная доходность из Firestore (коллекции `history` и `distributions` отвечают 403), история и дивиденды из Yahoo, холдинги из SEC N-PORT-P только если в Firestore их нет; лента в `api/amplify` как у остальных
- SP-Funds: брендовое имя `SP Funds`, лента `api/spfunds`
- Vanguard: курсор `MAX_FETCHES` хранится в `api/vanguard/update-state.json`

## 13. Инструменты

| Путь | Что это |
|---|---|
| `etf-std/registry.json` | реестр 29 брендов (единственный источник правды) |
| `etf-std/shared-blocks.md`, `regen-blocks.ts`, `apply-shared-blocks.ts` | общие таблицы README |
| `etf-std/gen-workflow.ts` | генератор workflow |
| `etf-std/check-readme.ts`, `check-workflow.ts`, `check-pages.ts`, `check-scripts.ts` | статические проверки |
| `etf-std/about.ts`, `verify-about.ts` | описание и темы GitHub |
| `verify_merge.sh`, `dep_merge.sh`, `pkg_normalize.sh`, `final_check.sh`, `prep.sh` | слияние и итоговая проверка |
| `dependabot.ref` | эталон `dependabot.yml` |

Добавление или изменение бренда: правка `registry.json`, `bun etf-std/regen-blocks.ts`, повторное применение блока в каждом репозитории, `bun test` везде (тесты считают бренды).
