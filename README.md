# BizGlance

## 样例演示

```powershell
pnpm install
pnpm --filter @bizglance/cli dev analyze --sample education --out .\dist\education.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\education.bizglance.json
```

## 本地 Java/Spring 演示

```powershell
pnpm --filter @bizglance/cli dev analyze --repo .\fixtures\java-spring-mini --lens java-spring --out .\dist\java-mini.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\java-mini.bizglance.json
```
