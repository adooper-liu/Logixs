export interface WorkNode {
  key: string
  name: string
  phase: 'done' | 'current' | 'todo' | 'optional' | 'skipped'
  tone?: 'ok' | 'warn' | 'risk'
  planned?: string
  actual?: string
  note?: string
}

export interface CheckItem {
  q: string
  state: 'ok' | 'warn' | 'risk'
  answer: string
  action: string
}

export interface EventRow {
  label: string
  planned?: string
  actual?: string
}

export interface ActionItem {
  code: string
  name: string
  desc: string
  channel: string
}

export interface ContainerInfo {
  containerNumber: string
  orderNumber: string
  billOfLading: string
  typeCode: string
  currentStatus: string
  statusTone: 'ok' | 'warn' | 'risk'
  location: string
  markers: { key: string; name: string }[]
  nextActionHint: string
  freeDaysLeft?: number
}

// 演示用脱敏示例（非真实业务）
export const container: ContainerInfo = {
  containerNumber: 'TCLU-2387642',
  orderNumber: '24DSA1954',
  billOfLading: 'MAEU254620074',
  typeCode: '40HQ',
  currentStatus: '已到港 · 清关中',
  statusTone: 'warn',
  location: '洛杉矶港 WWT 码头',
  markers: [
    { key: 'dangerous_goods', name: '危险品' },
    { key: 'phytosanitary', name: '需植检' }
  ],
  nextActionHint: '下一个动作：完成清关放行 → 一键派拖提柜',
  freeDaysLeft: 2
}

export const rail: WorkNode[] = [
  { key: 'ready', name: '备货就绪', phase: 'done', actual: '08-01' },
  { key: 'stuffing', name: '装箱定稿', phase: 'done', actual: '08-15', note: '40HQ · 66.2CBM · 42 托' },
  { key: 'shipment', name: '出运', phase: 'done', actual: '08-18' },
  { key: 'depart', name: '离港', phase: 'done', actual: '08-18 14:20' },
  { key: 'sailing', name: '海运在途', phase: 'done', actual: '09-05' },
  { key: 'transit', name: '中转港(可选)', phase: 'skipped', note: '未中转，跳过' },
  { key: 'customs', name: '清关', phase: 'current', tone: 'risk', planned: '09-10(今天)', note: 'ISF 待申报 · 传递 3/4' },
  { key: 'arrival', name: '目的港到港', phase: 'done', actual: '09-09', note: '已到港' },
  { key: 'rail', name: '海铁联运(可选)', phase: 'optional', note: '未启用' },
  { key: 'pickup', name: '拖卡提柜', phase: 'todo', tone: 'warn', planned: '最晚 09-12', note: '免费期剩余 2 天' },
  { key: 'delivery', name: '送仓', phase: 'todo' },
  { key: 'unload', name: '卸柜', phase: 'todo' },
  { key: 'unstuff', name: '卸空', phase: 'todo' },
  { key: 'return', name: '还箱', phase: 'todo', planned: '最晚 09-15' }
]

export const customsChecklist: CheckItem[] = [
  { q: '计划清关日期', state: 'risk', answer: '今天 09-10（不晚于今天）', action: '今天必须处理' },
  { q: '清关状态', state: 'warn', answer: '清关中', action: '跟进清关公司' },
  { q: '单据传递', state: 'warn', answer: '已传 3/4，缺失 1 份', action: '重传/查附件' },
  { q: '换单', state: 'ok', answer: '已换单', action: '—' },
  { q: 'ISF 申报', state: 'risk', answer: '未申报', action: '补充申报' },
  { q: '异常原因', state: 'warn', answer: '有备注：资料待补', action: '评估是否影响船期' }
]

export const timeline: EventRow[] = [
  { label: '离港', planned: '预计 08-18', actual: '实际 08-18' },
  { label: '到港', planned: '预计 09-11', actual: '实际 09-09' },
  { label: '清关放行', planned: '预计 09-10', actual: undefined }
]

export const nextActions: ActionItem[] = [
  { code: 'ISF 申报', name: '补充 ISF 申报', desc: '带已填资料重提交', channel: '海关申报' },
  { code: '重传单据', name: '重传缺失清关文件', desc: '附件按提单打包 ≤10MB', channel: '邮件/系统' },
  { code: '派拖提柜', name: '一键派拖提柜', desc: '默认拖车商 LA-01 · 09-11 08:00', channel: '运输指令' }
]

export const globalStats = [
  { name: '未出运', v: 18 },
  { name: '已出运/在途', v: 85 },
  { name: '已到港', v: 92 },
  { name: '已提柜', v: 41 },
  { name: '已卸柜/已还箱', v: 66 }
]

export const paperRows = [
  {
    box: 'TCLU-2387642',
    order: '24DSA1954',
    bl: 'MAEU254620074',
    status: '查验中',
    node: '查验',
    risk: '查验未完成',
    todo: 3,
    tone: 'risk',
    eta: '09-11',
    ata: '09-09',
    customs: '查验中',
    cond: '差',
    reached: ['出运', '在途', '查验']
  },
  {
    box: 'TRLU-9912034',
    order: '24DSA1955',
    bl: 'MAEU254620101',
    status: '已到港',
    node: '在途',
    risk: '正常',
    todo: 1,
    tone: 'ok',
    eta: '09-10',
    ata: '09-08',
    customs: '放行',
    cond: '优',
    reached: ['出运', '在途', '查验']
  },
  {
    box: 'MSKU-5521087',
    order: '24DSA1956',
    bl: 'MAEU254620115',
    status: '在途',
    node: '在途',
    risk: 'ETA 漂移',
    todo: 0,
    tone: 'warn',
    eta: '09-12',
    ata: '',
    customs: '—',
    cond: '良',
    reached: ['出运', '在途']
  }
]

export const stageNames = ['出运', '在途', '查验', '入库']
export const dayPerf = [
  { time: '09-05 09:00', box: 'TRLU-9912034', plan: '08:00 卸柜', act: '09:10 卸柜', state: 'done', note: '晚 1h' },
  { time: '09-05 10:30', box: 'TCLU-2387642', plan: '10:00 拖卡', act: '待执行', state: 'warn', note: '等待查验放行' },
  { time: '09-05 14:00', box: 'MSKU-5521087', plan: '15:00 到仓', act: '—', state: 'todo', note: '在途' }
]
