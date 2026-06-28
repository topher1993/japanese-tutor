import type { Quiz } from '../types/quiz';

export const quickQuiz: Quiz = {
  id: 'quiz-workplace-greetings-1',
  title: 'Workplace Survival Quick Quiz',
  lessonId: 'lesson-workplace-greetings',
  questions: [
    { id: 'q1', prompt: 'What does おはようございます mean?', choices: [{id:'A', text:'Good morning'}, {id:'B', text:'Good night'}, {id:'C', text:'I am late'}, {id:'D', text:'Danger'}], correctChoice: 'A', explanation: 'おはようございます is a polite good morning greeting.' },
    { id: 'q2', prompt: 'Which phrase can mean excuse me or sorry?', choices: [{id:'A', text:'ありがとうございます'}, {id:'B', text:'すみません'}, {id:'C', text:'行きます'}, {id:'D', text:'水'}], correctChoice: 'B', explanation: 'すみません is used for excuse me, sorry, or getting attention politely.' },
    { id: 'q3', prompt: 'What does ありがとうございます mean?', choices: [{id:'A', text:'Please stop'}, {id:'B', text:'Thank you very much'}, {id:'C', text:'I do not understand'}, {id:'D', text:'Break time'}], correctChoice: 'B', explanation: 'ありがとうございます is a polite thank-you phrase.' },
    { id: 'q4', prompt: 'Which phrase means “Please speak slowly”?', choices: [{id:'A', text:'ゆっくり話してください'}, {id:'B', text:'火事です'}, {id:'C', text:'病院'}, {id:'D', text:'お先に失礼します'}], correctChoice: 'A', explanation: 'ゆっくり話してください asks someone to speak slowly.' },
    { id: 'q5', prompt: 'What should you say when you do not understand?', choices: [{id:'A', text:'わかりません'}, {id:'B', text:'お疲れさまです'}, {id:'C', text:'出口'}, {id:'D', text:'右'}], correctChoice: 'A', explanation: 'わかりません means “I do not understand.”' },
    { id: 'q6', prompt: 'What does 止まってください mean?', choices: [{id:'A', text:'Please go left'}, {id:'B', text:'Please stop'}, {id:'C', text:'Please wait'}, {id:'D', text:'Please call'}], correctChoice: 'B', explanation: '止まってください is an urgent safety phrase meaning “Please stop.”' },
    { id: 'q7', prompt: 'Which phrase reports a fire?', choices: [{id:'A', text:'火事です'}, {id:'B', text:'休憩です'}, {id:'C', text:'確認します'}, {id:'D', text:'おはようございます'}], correctChoice: 'A', explanation: '火事です means “There is a fire.”' },
    { id: 'q8', prompt: 'What does 休憩は何時ですか ask?', choices: [{id:'A', text:'Where is the office?'}, {id:'B', text:'What time is break?'}, {id:'C', text:'Is this dangerous?'}, {id:'D', text:'May I drink water?'}], correctChoice: 'B', explanation: '休憩は何時ですか asks “What time is break?”' },
    { id: 'q9', prompt: 'Which phrase asks if there is overtime today?', choices: [{id:'A', text:'今日は残業がありますか'}, {id:'B', text:'今日は休みます'}, {id:'C', text:'頭が痛いです'}, {id:'D', text:'出口はどこですか'}], correctChoice: 'A', explanation: '今日は残業がありますか asks whether there is overtime today.' },
    { id: 'q10', prompt: 'What does この機械は壊れています mean?', choices: [{id:'A', text:'This machine is broken'}, {id:'B', text:'This is my helmet'}, {id:'C', text:'Please go right'}, {id:'D', text:'Tomorrow is a day off'}], correctChoice: 'A', explanation: 'この機械は壊れています reports that a machine is broken.' },
    { id: 'q11', prompt: 'Which phrase means “I need gloves”?', choices: [{id:'A', text:'手袋が必要です'}, {id:'B', text:'上司を呼んでください'}, {id:'C', text:'少々お待ちください'}, {id:'D', text:'水を飲んでもいいですか'}], correctChoice: 'A', explanation: '手袋が必要です means “I need gloves.”' },
    { id: 'q12', prompt: 'What does 体調が悪いです mean?', choices: [{id:'A', text:'I do not feel well'}, {id:'B', text:'I am finished'}, {id:'C', text:'Please check safety'}, {id:'D', text:'Good morning'}], correctChoice: 'A', explanation: '体調が悪いです is a polite way to say you do not feel well.' },
    { id: 'q13', prompt: 'Which phrase asks someone to call a supervisor?', choices: [{id:'A', text:'上司を呼んでください'}, {id:'B', text:'左に行ってください'}, {id:'C', text:'明日は休みですか'}, {id:'D', text:'これはどうしますか'}], correctChoice: 'A', explanation: '上司を呼んでください means “Please call a supervisor.”' },
    { id: 'q14', prompt: 'What does 出口はどこですか mean?', choices: [{id:'A', text:'Where is the exit?'}, {id:'B', text:'Where is the tool?'}, {id:'C', text:'Is this broken?'}, {id:'D', text:'May I rest?'}], correctChoice: 'A', explanation: '出口はどこですか asks “Where is the exit?”' },
    { id: 'q15', prompt: 'Which phrase confirms that you understand?', choices: [{id:'A', text:'はい、わかりました'}, {id:'B', text:'いいえ、まだです'}, {id:'C', text:'めまいがします'}, {id:'D', text:'救急車を呼んでください'}], correctChoice: 'A', explanation: 'はい、わかりました means “Yes, I understand.”' }
  ]
};
