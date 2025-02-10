import {ProblemDescriptor} from '../output'

export function problemDescriptorsDefaultFixture(): ProblemDescriptor[] {
  return [
    {
      level: 'failure',
      title: 'Control flow with empty body'
    },
    {
      level: 'warning',
      title: "Condition of 'if' expression is constant"
    },
    {
      level: 'warning',
      title: 'Rider toolset and environment errors'
    },
    {
      level: 'notice',
      title: "Might be 'const'"
    }
  ]
}

export function outputEmptyFixture(): ProblemDescriptor[] {
  return []
}