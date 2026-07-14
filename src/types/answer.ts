export interface ConceptRef {
  label: string
  id?: string
  explanation: string
}

export interface RichText {
  text: string
  concepts?: ConceptRef[]
}

export interface Bullet {
  term?: string
  explanation: RichText
}

export interface AnswerSection {
  heading: string
  content?: RichText
  bullets?: Bullet[]
}

export interface StructuredAnswer {
  summary: RichText
  sections?: AnswerSection[]
  note?: RichText
}

export interface TieredAnswer {
  shortAnswer: RichText
  answer: StructuredAnswer
  detail?: RichText
}
