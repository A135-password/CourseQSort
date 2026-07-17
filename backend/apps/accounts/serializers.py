from django.contrib.auth import authenticate
from rest_framework import serializers


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    major = serializers.CharField(read_only=True, allow_null=True)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs.get('username'),
            password=attrs.get('password')
        )
        if not user:
            raise serializers.ValidationError(
                'No active account found with the given credentials'
            )
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        profile = getattr(user, 'profile', None)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'role': profile.role if profile else 'STUDENT',
                'name': profile.name if profile else user.username,
                'email': user.email,
                'major': profile.major if profile else None,
            }
        }


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
