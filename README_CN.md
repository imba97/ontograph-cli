# ontograph-cli

> 实体关系知识图谱 CLI 工具

在终端中管理实体、建立关系、查询图谱。

## 安装

```bash
pnpm add -g ontograph-cli
```

## 快速上手

```bash
# 添加实体
ontograph add person imba97 --name "imba久期" --prop timezone=+8
ontograph add project website --name "网站重构" --prop status=active

# 建立关系
ontograph relate person:imba97 owns project:website

# 查询
ontograph related person:imba97
ontograph search 久期

# 列表
ontograph list
ontograph types
```

## 命令参考

### `add <type> <id>`

添加实体。

```bash
ontograph add <type> <id> --name <名称> [--prop key=value ...]
```

### `relate <from> <rel> <to>`

建立实体间关系。

```bash
ontograph relate <from> <rel> <to>
```

### `unrelate <from> <rel> <to>`

取消关系。

```bash
ontograph unrelate <from> <rel> <to>
```

### `related <id>`

查询关联实体。

```bash
ontograph related <id> [--rel <关系类型>]
```

### `search <query>`

按名称或 ID 搜索实体。

```bash
ontograph search <关键词>
```

### `list [type]`

列出实体，可按类型过滤。

```bash
ontograph list [type]
```

### `types`

列出所有实体类型。

```bash
ontograph types
```

## 概念

### 实体 (Entity)

一切皆实体——人物、项目、任务、标签……实体由类型和 ID 唯一标识，支持自定义属性。

```
person:imba97  →  name: "imba久期", timezone: "+8"
project:website →  name: "网站重构", status: "active"
```

### 关系 (Relation)

实体之间的有向关联。

```
person:imba97 --owns--> project:website
project:website --has_task--> task:design
```

## 数据存储

数据默认存储在 `~/.hermes/data/ontograph-cli`，可通过 `--data-dir` 指定其他路径。

目录结构如下：

```text
~/.hermes/data/ontograph-cli/
  index.yaml
  relations.yaml
  entities/
    <type>/
      <id>.yaml
```

## Hermes Agent 集成

本工具附带 `SKILL.md`，Hermes Agent 可直接识别并通过 `terminal` 调用：

```bash
ontograph search <关键词>
ontograph related <id>
ontograph list
```

## License

MIT
