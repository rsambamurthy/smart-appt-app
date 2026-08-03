-- Correct the managing committee's description.
--
-- The seed text said "everyone with the Committee role", which was true of the
-- first implementation and no longer is. The managing committee is now every
-- Manager, Treasurer and Committee member, plus the convenors of the
-- sub-committees who are not already one of those.
--
-- Only rows still carrying the original wording are touched, so an association
-- that has edited its own description keeps it.
UPDATE "committees"
SET    "description" = 'Managers, treasurers and committee members, plus the convenors of each sub-committee.',
       "updated_at"  = now()
WHERE  "is_managing" = true
  AND  "description" = 'The elected managing committee. Members are everyone with the Committee role.';
