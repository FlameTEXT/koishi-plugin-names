import { Context, Schema, Random } from 'koishi'
import zhName from './json/zh-name.json'
import zhSurname from './json/zh-surname.json'
import enName from "./json/en-name.json"
import enSurname from './json/en-surname.json'
import jpName from './json/jp-name.json'
import jpSurname from './json/jp-surname.json'


export const name = 'names'

export interface Config {
  numMax: number
  weights: boolean
  split: string
  translatorExample: string
}

export const Config: Schema<Config> = Schema.object({
  weights: Schema.boolean().default(false).description('name 是否自动开启 姓氏权重抽取 选项'),
  numMax: Schema.number().default(10).description('单次指令抽取名字的上限'),
  split: Schema.string().default('、').description("名字之间的分隔符号"),
  translatorExample: Schema.string().default('{0}（{1}）').description('0 代表原名、1代表翻译后的')
})

declare module 'koishi' {
  interface Context {
    translator: any
  }
}

interface NameSet {
  surname: Record<string, number> | string[]
  name: {
    'male': string[] | null
    'female': string[] | null
    'ta': string[] | null
  }
}

const GENDER_ARR = ['male', 'female', 'ta']

export function apply(ctx: Context, config: Config) {
  ctx.command('name [area] [num:number]')
    .option('weights', '-w 使用权重抽取姓氏', { fallback: config.weights })
    //.option('gender', '-g [s:string] s 可选男/man/m、女/female/w、其他/ta/t 指定性别；不指定完全随机')
    .option('locale', '-l 抽取外文名时加上翻译')
    .option('male', "-m 指定抽取男名")
    .option('female', "-f 指定抽取女名")
    .option('ta', "-t 指定性别倾向不明的名")
    .usage(`area 的可选项有 zh ，默认 zh；num 最大${config.numMax}，默认 5；性别指定取决于语料，不能保证正确`)
    .example('.name zh 9 -t')
    .userFields(['locale'])
    .action(async (argv, area = 'zh', num = 5) => {
      let name_set = {} as NameSet
      switch (area) {
        case 'jp':
          name_set['surname'] = jpSurname
          name_set['name'] = jpName
          break
        case 'en':
          name_set['surname'] = enSurname
          name_set['name'] = enName
          break
        default:
          name_set['surname'] = zhSurname
          name_set['name'] = zhName
      }
      if (num > config.numMax) num = config.numMax
      if (num < 1) num = 1
      const { options: { weights, male, female, ta, locale } } = argv
      let gender = ''
      if (male) gender = 'male'
      if (female) gender = 'female'
      if (ta) gender = 'ta'
      let arr = []
      for (let i = 0; i < num; i++) {
        let surname = '', name = ''
        if (Array.isArray(name_set['surname'])) {
          surname = Random.pick(name_set['surname'])
        } else if (weights) {
          surname = Random.weightedPick(name_set['surname'])
        } else {
          [surname] = Random.pick(Object.entries(name_set['surname']))
        }
        let r = gender != '' ? gender : Random.pick(GENDER_ARR)
        if (name_set['name'][r] == null) r = Random.shuffle(GENDER_ARR).find(x => name_set['name'][x] != null)
        name = Random.pick(name_set['name'][r])
        arr.push(format([surname, name], area))
      }
      const user_locale = argv.session.user.locale || 'zh'
      if (ctx.translator && locale && user_locale != area) {
        for (let i = 0; i < arr.length; i++) {
          const foo = await ctx.translator.translate({ input: arr[i], target: user_locale, detail: true })
          arr[i] = config.translatorExample.replace('{0}', arr[i]).replace('{1}', foo)
        }
      }
      return arr.length > 1 ? arr.join(config.split) : arr[0]
    })
}

function format(arr, area) {
  switch (area) {
    case 'jp': return arr.join(' ')
    case 'en': return arr[1] + '·' + arr[0]
    default:
      return arr.join('')
  }
}
