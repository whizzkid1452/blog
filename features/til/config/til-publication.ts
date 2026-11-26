// 평소에는 공부 일지를 숨기고, 명시적으로 설정한 개발 미리보기에서만 엽니다.
export const IS_TIL_PUBLISHED =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_TIL_LOCAL_PREVIEW === '1';
