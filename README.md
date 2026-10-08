# stream-marketplace

Stream 팀이 쓰는 Claude Code 플러그인 마켓플레이스.

| 플러그인 | 내용 |
| --- | --- |
| [`senv`](plugins/senv) | senv(Stream Env Control) CLI로 환경변수를 안전하게 다루는 스킬, 값 파일 읽기를 막는 훅 |

## 설치

billilge org 멤버면 이 비공개 저장소를 git으로 받을 수 있어야 한다 (`gh auth login` 또는 GitHub SSH 키).

```text
/plugin marketplace add billilge/stream-marketplace
/plugin install senv@stream-marketplace
```

갱신:

```text
/plugin marketplace update stream-marketplace
```

## 서비스 저장소에 넣을 설정

senv를 쓰는 저장소(`senv.json`이 있는 저장소)의 `.claude/settings.json`에 넣고 커밋하면, 팀원이 그 저장소에서 Claude Code를 열 때 마켓플레이스와 플러그인 설치를 권한다. `permissions.deny`는 훅과 별개로 값 파일 읽기를 한 번 더 막는다 (플러그인은 권한 규칙을 배포할 수 없다).

```json
{
  "extraKnownMarketplaces": {
    "stream-marketplace": {
      "source": { "source": "github", "repo": "billilge/stream-marketplace" }
    }
  },
  "enabledPlugins": {
    "senv@stream-marketplace": true
  },
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./**/.env)", "Read(./**/.env.*)"]
  }
}
```

`Read(./.env.*)`는 `.env.example`도 막는다. 예시 파일을 Claude가 읽어야 하면 그 줄을 빼고 훅에 맡긴다.

## 개발

```sh
node --test plugins/senv/hooks/        # 훅 테스트 (Node 22 이상, 의존성 없음)
claude plugin validate .               # 마켓플레이스·플러그인 구조 검사
```

플러그인을 바꾸면 `plugins/<이름>/.claude-plugin/plugin.json`의 `version`을 올린다.
