-- Add get_user_entity_permissions function
CREATE OR REPLACE FUNCTION get_user_entity_permissions(
    p_user_id uuid,
    p_entity_id uuid
)
RETURNS TABLE(
    permission_name character varying,
    has_permission boolean,
    is_denied boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_permission_class_id uuid;
BEGIN
    -- Get Permission class
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' LIMIT 1;

    RETURN QUERY
    SELECT 
        e_perm.display_name,
        (check_entity_permission(p_user_id, p_entity_id, e_perm.display_name)).has_permission,
        (check_entity_permission(p_user_id, p_entity_id, e_perm.display_name)).is_denied
    FROM entities e_perm
    WHERE e_perm.class_id = v_permission_class_id
      AND e_perm.deleted_at IS NULL
    ORDER BY COALESCE((e_perm.attributes->>'level')::integer, 0);
END;
$function$;
