from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminUser
from apps.common.pagination import PageNumberPagination
from apps.protected_slots.models import ProtectedSlot
from apps.protected_slots.serializers import ProtectedSlotSerializer


class ProtectedSlotViewSet(viewsets.ModelViewSet):
    queryset = ProtectedSlot.objects.all()
    serializer_class = ProtectedSlotSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination

    @action(detail=False, methods=['put'], url_path='batch-update')
    def batch_update(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response(
                {'detail': 'Expected a list of slot objects'},
                status=status.HTTP_400_BAD_REQUEST
            )
        ProtectedSlot.objects.all().delete()
        created = []
        for item in data:
            serializer = self.get_serializer(data=item)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            created.append(serializer.save())
        return Response({'updated_count': len(created)})
