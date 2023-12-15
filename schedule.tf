resource "aws_cloudwatch_event_rule" "this" {
  name                = var.name
  description         = "Run ${var.name} as per the schedule"
  schedule_expression = var.schedule
  state               = "ENABLED"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "this" {
  rule      = aws_cloudwatch_event_rule.this.name
  target_id = "Trigger-${var.name}"
  arn       = aws_lambda_function.this.arn
}

resource "aws_lambda_permission" "this" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.this.arn
}
