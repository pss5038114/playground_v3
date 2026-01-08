from passlib.context import CryptContext

# [변경] 설치가 까다로운 bcrypt 대신, 파이썬 기본 기능만으로 작동하는 pbkdf2_sha256을 사용합니다.
# 이 방식은 72자 제한도 없고, 별도의 C++ 컴파일러도 필요 없습니다.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def hash_password(password: str):
    """비밀번호를 안전하게 암호화합니다."""
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    """입력한 비밀번호와 저장된 암호를 비교합니다."""
    return pwd_context.verify(plain_password, hashed_password)