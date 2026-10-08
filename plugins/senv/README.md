# senv 플러그인

senv(Stream Env Control) CLI를 쓰는 저장소에서 Claude Code가 환경변수를 안전하게 다루게 한다.

| 구성 | 하는 일 |
| --- | --- |
| 스킬 `senv` (`skills/senv/SKILL.md`) | 값 파일을 읽지 않기, `senv run`·`list`·`diff`·`status` 쓰기, 값을 바꿀 때 승인 받기, 새 키 추가 순서, Spring Boot 사용법, 문제 해결 |
| 훅 (`hooks/`) | Read·Edit·Write·Grep·Bash가 senv 값 파일을 가리키면 막고 senv 명령을 안내한다 |

## 훅이 막는 것

- `senv.json`이 있는 폴더(또는 그 아래)의 `.env`, `.env.*` 파일과 `senv.json`의 `output`. `.env.example`, `.env.sample`, `.env.template`처럼 예시용 이름은 막지 않는다.
- `senv.json`이 없는 저장소에는 아무 영향이 없다.
- Bash는 명령을 `&&`, `||`, `;`, `|` 단위로 나눠 본다. 값 파일을 가리키는 부분의 첫 단어가 `senv`, `ls`, `stat`, `test`, `chmod`가 아니면 막는다. 셸 해석이 완전하지 않으므로 저장소의 `permissions.deny`와 함께 쓴다 (마켓플레이스 README 참고).

훅은 `node`로 실행한다. senv CLI가 Node 22 이상을 요구하므로 senv를 쓰는 PC에는 이미 있다.
