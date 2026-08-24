import os

redis_conn = os.getenv("REDIS_URL")
aws_region = os.environ.get("AWS_REGION") # Missing in .env!

def get_redis_config():
    return redis_conn
