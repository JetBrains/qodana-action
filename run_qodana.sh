#!/bin/bash

get_str_arg_or_empty() {
    local argument_name=$1
    local argument_value=$2
    [ -n "$argument_value" ] && echo "$argument_name $argument_value" || echo ""
}

get_bool_arg_or_empty() {
    local argument_name=$1
    local argument_value=$2
    [ "$argument_value" == "true" ] && echo "$argument_name" || echo ""
}

mkdir -p "$RESULTS_DIR" "$CACHE_DIR"

docker run -u $UID -v "$PROJECT_DIR:/data/project" -v "$RESULTS_DIR:/data/results" \
    -v "$CACHE_DIR:/data/cache" jetbrains/qodana:2021.2-eap \
    $(get_str_arg_or_empty "-d" "$INSPECTED_DIR") \
    $(get_str_arg_or_empty "-b" "$BASELINE") \
    $(get_bool_arg_or_empty "--baseline-include-absent" "$BASELINE_INCLUDE_ABSENT") \
    $(get_str_arg_or_empty "--fail-threshold" "$FAIL_THRESHOLD") \
    $(get_bool_arg_or_empty "--save-report" "$SAVE_HTML_REPORT") \
    $(get_str_arg_or_empty "-profileName" "$PROFILE_NAME") \
    $(get_str_arg_or_empty "-profilePath" "$PROFILE_PATH")
