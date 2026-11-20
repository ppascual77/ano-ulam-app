# Helpers for security.test.sh. Each check runs one SQL statement as a given
# identity, the way PostgREST would (role + request.jwt.claims), and compares
# the outcome with what's expected:
#   t "<name>" <who> <expect> "<sql>"
#   who:    anon | svc (no role switch, like the service role) | A B C D PRO ADM
#   expect: ok (no error) | deny (an error) | =<value> (the last output line)
# PGHOST / PGPORT / PGDATABASE come from run.sh.
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002; C=cccccccc-0000-0000-0000-000000000003; D=dddddddd-0000-0000-0000-000000000004; ADM=adadadad-0000-0000-0000-00000000000a; PRO=9a9a9a9a-0000-0000-0000-000000000009
BASE='https://ykrultxqfxgyiziqrrgp.supabase.co/storage/v1/object/public'
PASS=0; FAIL=0
t() {
  local name="$1" who="$2" expect="$3" sql="$4" pre
  case $who in
    anon) pre="set role anon; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false);";;
    svc) pre="";;
    ADM) pre="set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$ADM\",\"role\":\"authenticated\",\"app_metadata\":{\"role\":\"admin\"}}',false);";;
    *) local id=${!who}; pre="set role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$id\",\"role\":\"authenticated\",\"app_metadata\":{}}',false);";;
  esac
  local out got res
  out=$(psql -X -At -q -v ON_ERROR_STOP=1 -c "$pre" -c "$sql" 2>&1 | grep -v '^{"' )
  if echo "$out" | grep -q "ERROR"; then got=deny; out=$(echo "$out" | grep ERROR | head -1); else got=ok; out=$(echo "$out" | tail -1); fi
  if [[ $expect == =* ]]; then [[ "$out" == "${expect#=}" ]] && res=PASS || res=FAIL
  else [[ $got == $expect ]] && res=PASS || res=FAIL; fi
  [[ $res == PASS ]] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
  printf "%-4s | %-5s | %-62s | expect %-8s | got: %s\n" "$res" "$who" "$name" "$expect" "$(echo $out | cut -c1-110)"
}
