from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminUser
from apps.algorithm_config.models import AlgorithmConfig
from apps.algorithm_config.serializers import AlgorithmConfigSerializer


class AlgorithmConfigRetrieveUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        config = self._get_config()
        serializer = AlgorithmConfigSerializer(config)
        data = serializer.data
        data["updated_by"] = serializer.get_updated_by(config)
        return Response(data)

    def put(self, request):
        config = self._get_config()
        serializer = AlgorithmConfigSerializer(config, data=request.data, partial=False)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(updated_by=request.user)
        data = serializer.data
        config.refresh_from_db()
        data["updated_by"] = AlgorithmConfigSerializer().get_updated_by(config)
        return Response(data)

    def patch(self, request):
        config = self._get_config()
        serializer = AlgorithmConfigSerializer(config, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(updated_by=request.user)
        config.refresh_from_db()
        serializer2 = AlgorithmConfigSerializer(config)
        return Response(serializer2.data)

    def _get_config(self):
        config, _ = AlgorithmConfig.objects.get_or_create(pk=1)
        return config
