# ontology

> 实体关系知识图谱 CLI 工具

在终端中管理实体、建立关系、查询图谱。

## 安装

```bash
pnpm add -g ontology
```

## 快速上手

```bash
# 添加实体
ontology add person imba97 --name "imba久期" --prop timezone=+8
ontology add project website --name "网站重构" --prop status=active

# 建立关系
ontology relate person:imba97 owns project:website

# 查询
ontology related person:imba97
ontology search 久期

# 列表
ontology list
ontology types
```

## 命令参考

### `add <type> <id>`

添加实体。

```bash
ontology add <type> <id> --name <名称> [--prop key=value ...]
```

### `relate <from> <rel> <to>`

建立实体间关系。

```bash
ontology relate <from> <rel> <to>
```

### `unrelate <from> <rel> <to>`

取消关系。

```bash
ontology unrelate <from> <rel> <to>
```

### `related <id>`

查询关联实体。

```bash
ontology related <id> [--rel <关系类型>]
```

### `search <query>`

按名称或 ID 搜索实体。

```bash
ontology search <关键词>
```

### `list [type]`

列出实体，可按类型过滤。

```bash
ontology list [type]
```

### `types`

列出所有实体类型。

```bash
ontology types
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

数据默认存储在 `~/.hermes/data/ontology/entities.json`，可通过 `--data-dir` 指定其他路径。

## Hermes Agent 集成

本工具附带 `SKILL.md`，Hermes Agent 可直接识别并通过 `terminal` 调用：

```bash
ontology search <关键词>
ontology related <id>
ontology list
```

## License

MIT
