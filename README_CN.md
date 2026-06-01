# ontograph-cli

> 实体关系知识图谱 CLI 工具

在终端中管理实体、建立关系、查询图谱。

## 安装

```bash
pnpx skills add imba97/ontograph-cli -g -a your-agent
```

## 快速上手

```bash
# 添加实体
ontograph add person --name "imba久期" --prop timezone=+8
ontograph add project --name "网站重构" --prop status=active

# 更新实体
ontograph update person_62c0841a --name "imba97" --prop timezone=+9

# 建立关系
ontograph relate person_62c0841a owns project_8f2b44cd

# 查询
ontograph related person_62c0841a
ontograph search 久期

# 列表
ontograph list
ontograph types
```

## 命令参考

### `add <type>`

添加实体。

```bash
ontograph add <type> [--name <名称>] [--prop key=value ...]
```

### `update <id>`

更新已存在实体，支持部分字段更新。

```bash
ontograph update <id> [--name <名称>] [--prop key=value ...]
```

### `remove <id>`

删除实体，并级联移除相关关系。

```bash
ontograph remove <id>
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

### `entity-type <action> [name]`

管理自定义实体类型，支持 `list` `view` `add` `remove` `update`。

```bash
# 更新自定义实体类型定义
ontograph entity-type update <name> [--name <显示名>] [--desc <描述>] [--field <字段定义...>]
```

字段定义格式与 `add` 保持一致：`fieldKey:fieldType:required:enum1,enum2`。

### `relation-type <action> [name]`

管理自定义关系类型，支持 `list` `view` `add` `remove` `update`。

```bash
# 更新自定义关系类型定义
ontograph relation-type update <name> [--name <显示名>] [--desc <描述>] [--from <类型...>] [--to <类型...>]
```

说明：`update` 采用强制更新策略，会直接覆盖定义文件，不做历史数据兼容性检查。

## 概念

### 实体 (Entity)

一切皆实体——人物、项目、任务、标签……实体由类型前缀加自动生成 ID 唯一标识，支持自定义属性。

`person_62c0841a  →  name: "imba久期", timezone: "+8"`  
`project_8f2b44cd →  name: "网站重构", status: "active"`

### 关系 (Relation)

实体之间的有向关联。

`person_62c0841a --owns--> project_8f2b44cd`  
`project_8f2b44cd --has_task--> task_c9d1a2ef`

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
