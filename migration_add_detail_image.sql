-- 기존 D1 데이터베이스에서 한 번만 실행하세요.
-- 기존 image_key는 카드 썸네일로 유지합니다.
ALTER TABLE projects ADD COLUMN detail_image_key TEXT;
