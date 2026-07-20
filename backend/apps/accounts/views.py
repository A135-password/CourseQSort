from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            # 提取中文错误信息
            errors = serializer.errors
            detail = "账号或密码错误"
            for key in ("detail", "non_field_errors", "username", "password"):
                if key in errors:
                    val = errors[key]
                    detail = val[0] if isinstance(val, list) else str(val)
                    break
            return Response({"detail": detail}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.validated_data)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()
            return Response({"detail": "Successfully logged out"})
        except Exception:
            return Response({"detail": "Invalid or expired refresh token"}, status=status.HTTP_400_BAD_REQUEST)


class RegisterView(APIView):
    """注册接口 — 学生/教师通过真实姓名+学号/工号绑定数据库中的记录"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        # 注册成功后自动登录，返回 JWT
        profile = getattr(user, "profile", None)
        refresh = RefreshToken.for_user(user)

        # 获取教师/学生 ID
        teacher_id = None
        student_id = None
        teacher_dept = None
        if profile and profile.role == "TEACHER":
            from apps.courses.models import Teacher

            teacher = Teacher.objects.filter(user=user).first()
            if teacher:
                teacher_id = teacher.id
                teacher_dept = teacher.department or ""
        elif profile and profile.role == "STUDENT":
            from apps.courses.models import Student

            student = Student.objects.filter(user=user).first()
            if student:
                student_id = student.id

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": profile.role if profile else "STUDENT",
                    "name": profile.name if profile else user.username,
                    "teacher_id": teacher_id,
                    "teacher_dept": teacher_dept,
                    "student_id": student_id,
                },
                "detail": "注册成功",
            },
            status=status.HTTP_201_CREATED,
        )


class ResetPasswordView(APIView):
    """重置密码 — 凭学号/工号 + 姓名验证，无需旧密码"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"detail": "密码修改成功，请使用新密码登录"}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        data = UserSerializer(
            {
                "id": request.user.id,
                "username": request.user.username,
                "role": profile.role if profile else "STUDENT",
                "name": profile.name if profile else request.user.username,
                "email": request.user.email,
                "major": profile.major if profile else None,
            }
        ).data
        return Response(data)
