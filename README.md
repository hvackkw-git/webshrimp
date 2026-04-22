# webshrimp

moving shrimp

## Shrimp asset making program

Use `shrimp_asset_maker.py` to generate a simple shrimp SVG asset and matching metadata JSON.

```bash
python shrimp_asset_maker.py --name hero-shrimp --color coral --size 96 --output-dir assets
```

This creates:

- `assets/hero-shrimp.svg`
- `assets/hero-shrimp.json`
# Shrimp Web Demo

## 파일 구성
- `index.html`: 브라우저에서 바로 여는 진입 파일
- `app.js`: 파츠 조립, 앵커 검증, 애니메이션, 레이어 처리
- `assets/`: PNG 파츠 파일

## 실행 방법
정적 서버로 열면 됩니다.

예시:
- VS Code Live Server
- `python -m http.server`

그 다음 브라우저에서 `index.html`을 열면 됩니다.

## 현재 레이어 규칙
- `mouth1`, `mouth2`는 `head` 뒤
- 다리 8개는 좌→우 기준으로 교차
  - 1번째 체인: chest 뒤
  - 2번째 체인: chest 앞
  - 3번째 체인: chest 뒤
  - 4번째 체인: chest 앞
  - ...
- 손 2개 체인은 파란 앵커 좌→우 기준
  - 왼쪽 체인: head 뒤
  - 오른쪽 체인: head 앞

## 현재 움직임
- 몸통: tail 진폭 5도, 앞쪽으로 갈수록 감소
- chest: 고정(흔들림 없음)
- leg1: 5~10도
- leg2: 5~10도
- 다리 8개는 위상차를 두고 물결치듯 순차적으로 움직임

## 파츠 텍스트 설정 형식
- `part = (기본각도, 가동범위),(갈때속도, 돌아올때속도);`
- 예시: `tail = (-20, 5),(4, 5);`
