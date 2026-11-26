export const IS_TIL_BOARD_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_TIL_LOCAL_PREVIEW === '1';

export const IS_TIL_DETAIL_ENABLED = process.env.NODE_ENV === 'production' || IS_TIL_BOARD_ENABLED;
