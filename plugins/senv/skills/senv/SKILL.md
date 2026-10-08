---
name: senv
description: senv(Stream Env Control) CLI로 환경변수·시크릿을 다루는 방법. 저장소에 senv.json이 있거나, 사용자가 환경변수, .env 파일, 설정 값, API 키, DB 주소를 묻거나, 앱·테스트를 실행해야 하거나(환경변수가 필요한 pnpm dev, ./gradlew bootRun 등), 코드에 새 환경변수를 추가할 때 쓴다. Use when a repo has senv.json or the task involves environment variables, .env files, secrets, or running an app/tests that need them.
---

# senv로 환경변수 다루기

senv는 billilge 팀의 환경변수 관리 도구다. 값은 서버(`https://senv.stream.billilge.site`)에 암호화돼 있고, 저장소의 `senv.json`(커밋된 파일)이 이 폴더가 어느 프로젝트·환경·출력 파일을 쓰는지 정한다.

```json
{ "project": "web", "defaultEnv": "local", "output": ".env.local", "format": "dotenv" }
```

환경은 `local`, `development`, `production` 셋이다. `--env`를 주지 않으면 `defaultEnv`를 쓴다.

## 지켜야 할 것

1. **값 파일을 읽거나 출력하지 않는다.** `.env`, `.env.*`(`.env.example` 같은 예시 파일은 괜찮다)와 `senv.json`의 `output` 파일이 값 파일이다. `cat`, `grep`, `source`로도 열지 않는다. 이 플러그인의 훅이 막지만, 훅을 피해 가는 방법을 찾지 않는다.
2. **값을 대화, 로그, 코드, 커밋, 다른 파일에 옮기지 않는다.** 키 이름은 괜찮다.
3. **`senv get KEY`는 사용자가 그 값을 보여 달라고 직접 요청했을 때만 쓴다.**
4. **값을 바꾸기 전에 채팅에서 승인을 받는다.** 바꿀 키와 환경, 바뀐 뒤 값을 보여 주고(secret이면 값은 가린다) 승인을 받은 다음 `--yes`를 붙여 실행한다. 이 환경에는 확인 프롬프트에 답할 터미널이 없어서 `--yes` 없이 실행하면 멈추거나 실패한다.
5. **production 값은 바꾸지 않는다.** CLI가 프로젝트 이름을 다시 입력하게 해서 Claude가 실행할 수 없다. 필요하면 사용자에게 명령을 알려 주고 직접 실행하게 한다 (`! senv set KEY=VALUE --env production`).
6. **값 파일을 커밋하지 않는다.** `.gitignore`에 들어 있는지는 `senv doctor`로 확인한다.

## 자주 하는 일

| 하려는 일 | 명령 |
| --- | --- |
| 앱·테스트 실행 (파일을 남기지 않는다, 기본) | `senv run -- pnpm dev`, `senv run -- ./gradlew bootRun`, `senv run --env development -- pnpm test` |
| 어떤 키가 있는지 | `senv list` (값은 가려진다) |
| 받은 파일이 최신인지 | `senv status` |
| 받은 파일과 서버의 차이 | `senv diff` (키 이름만 보여준다) |
| 파일이 꼭 필요한 도구용으로 받기 | `senv pull` |
| 설정·로그인·.gitignore·필수 키 점검 | `senv doctor` |
| 값 바꾸기 (승인 후) | `senv set KEY=VALUE --env local --message "이유" --yes` |

`senv run`이 기본이다. `.env` 파일을 직접 읽는 도구(IDE 실행 버튼 등)에만 `senv pull`을 쓴다.

## 코드에 새 환경변수가 필요할 때

1. 키 이름은 대문자·숫자·밑줄이고 숫자로 시작하지 않는다 (`^[A-Z_][A-Z0-9_]*$`). 예: `PAYMENT_API_URL`.
2. 브라우저·앱 번들에 들어가는 이름(`VITE_`, `EXPO_PUBLIC_` 접두사)에는 secret을 넣지 않는다. senv가 pull·run을 멈춘다.
3. local 값이 필요하면 사용자에게 값과 함께 승인을 받아 `senv set NEW_KEY=... --env local --yes`로 넣는다. 값을 모르면 사용자에게 묻는다. 값을 지어내지 않는다.
4. development·production 값과 키 스키마(필수 여부, secret, 타입)는 대시보드에서 담당자가 정한다고 사용자에게 알린다.
5. 저장소에 `.env.example` 같은 예시 파일이 있으면 키 이름과 설명만 추가한다 (값은 넣지 않는다).

## Spring Boot

- 터미널에서는 `senv run -- ./gradlew bootRun`, `senv run -- ./gradlew test`를 쓴다. Spring은 환경변수를 바로 읽는다 (`SPRING_DATASOURCE_URL` → `spring.datasource.url`).
- IntelliJ 실행 버튼처럼 senv를 거치지 않는 실행은 `senv.json`의 `"format": "properties"`로 받은 파일을 `application-local.yml`에서 `spring.config.import: optional:file:.env.local.properties`로 읽는다. 이 파일의 키에는 relaxed binding이 적용되지 않으므로 `${DB_URL}`처럼 참조한다.
- Spring은 값 안의 `${...}`를 다른 속성 값으로 바꾼다. 그런 값이 있으면 `senv pull`이 알려준다.

## 문제가 생기면

| 증상 | 할 일 |
| --- | --- |
| 로그인이 필요하다, 401 | 브라우저 승인이 필요하므로 사용자에게 `! senv login`을 실행해 달라고 한다 |
| `senv.json`을 찾을 수 없다 | 프로젝트 이름을 사용자에게 물어 `senv init --project <이름>`을 실행한다 (Spring은 `--format properties`도) |
| 권한이 없다, 403 | 대시보드 관리자에게 권한을 요청하라고 안내한다 |
| 공개 접두사에 secret이 있다며 멈춘다 | 키 이름이나 키 스키마를 고쳐야 한다. 대시보드 담당자에게 알린다 |
| `senv` 명령이 없다 | `npm i -g @billilge/senv` (GitHub Packages, `~/.npmrc`에 `@billilge:registry=https://npm.pkg.github.com`과 `read:packages` 토큰이 필요하다) |
