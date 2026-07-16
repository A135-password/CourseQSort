from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import LoginSerializer, UserSerializer, LogoutSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'No active account found with the given credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
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
            token = RefreshToken(serializer.validated_data['refresh'])
            token.blacklist()
            return Response({'detail': 'Successfully logged out'})
        except Exception:
            return Response(
                {'detail': 'Invalid or expired refresh token'},
                status=status.HTTP_400_BAD_REQUEST
            )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        data = UserSerializer({
            'id': request.user.id,
            'username': request.user.username,
            'role': profile.role if profile else 'STUDENT',
            'name': profile.name if profile else request.user.username,
            'email': request.user.email,
            'major': profile.major if profile else None,
        }).data
        return Response(data)
