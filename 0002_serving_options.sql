-- Add disabled options without changing existing prices or publishing drafts.
UPDATE items SET
 draft=CASE WHEN json_type(draft,'$.servingOptions') IS NULL THEN json_set(draft,'$.servingOptions',json('[{"id":"plain","name":"ساده","enabled":false,"price":null},{"id":"mixed-cheese","name":"میکس پنیر","enabled":false,"price":null},{"id":"mushroom-cheese","name":"قارچ و پنیر","enabled":false,"price":null}]')) ELSE draft END,
 published=CASE WHEN published IS NOT NULL AND json_type(published,'$.servingOptions') IS NULL THEN json_set(published,'$.servingOptions',json('[{"id":"plain","name":"ساده","enabled":false,"price":null},{"id":"mixed-cheese","name":"میکس پنیر","enabled":false,"price":null},{"id":"mushroom-cheese","name":"قارچ و پنیر","enabled":false,"price":null}]')) ELSE published END,
 version=version+1
WHERE json_type(draft,'$.servingOptions') IS NULL OR (published IS NOT NULL AND json_type(published,'$.servingOptions') IS NULL);
